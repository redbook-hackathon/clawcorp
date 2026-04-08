import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CommanderExceptionsFeed, ExceptionFeedItem } from "../types";

const POLICY_PATH = join(process.cwd(), "runtime", "notification-policy.json");

type NotificationLevel = ExceptionFeedItem["level"];
export type NotificationRoute = ExceptionFeedItem["route"] | "silent";

export interface NotificationPolicyConfig {
  quietHours: {
    enabled: boolean;
    startHour: number;
    endHour: number;
    timezoneOffsetMinutes: number;
    suppressLevels: NotificationLevel[];
  };
  routing: Record<NotificationLevel, ExceptionFeedItem["route"]>;
}

export interface NotificationPolicyLoadResult {
  path: string;
  policy: NotificationPolicyConfig;
  issues: string[];
}

export interface NotificationPreviewItem {
  itemId: string;
  level: NotificationLevel;
  code: ExceptionFeedItem["code"];
  source: ExceptionFeedItem["source"];
  sourceId: string;
  message: string;
  sourceRoute: ExceptionFeedItem["route"];
  routedTo: NotificationRoute;
  suppressedByQuietHours: boolean;
}

export interface NotificationPreview {
  generatedAt: string;
  evaluatedAt: string;
  inQuietHours: boolean;
  path: string;
  issues: string[];
  policy: NotificationPolicyConfig;
  counts: {
    input: number;
    suppressed: number;
    routed: number;
    byRoute: Record<NotificationRoute, number>;
    byLevel: Record<NotificationLevel, number>;
  };
  items: NotificationPreviewItem[];
}

export async function loadNotificationPolicy(): Promise<NotificationPolicyLoadResult> {
  try {
    const raw = await readFile(POLICY_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return normalizePolicy(parsed);
  } catch {
    return {
      path: POLICY_PATH,
      policy: defaultNotificationPolicy(),
      issues: [],
    };
  }
}

export function buildNotificationPreview(
  feed: CommanderExceptionsFeed,
  loaded: NotificationPolicyLoadResult,
  evaluatedAt: Date = new Date(),
): NotificationPreview {
  const inQuietHours = isInQuietHours(loaded.policy, evaluatedAt);

  const items = feed.items.map((item) => {
    const suppressedByQuietHours =
      inQuietHours && loaded.policy.quietHours.suppressLevels.includes(item.level);
    const routedTo: NotificationRoute = suppressedByQuietHours
      ? "silent"
      : loaded.policy.routing[item.level] ?? item.route;

    return {
      itemId: `${item.code}:${item.source}:${item.sourceId}`,
      level: item.level,
      code: item.code,
      source: item.source,
      sourceId: item.sourceId,
      message: item.message,
      sourceRoute: item.route,
      routedTo,
      suppressedByQuietHours,
    };
  });

  const byRoute: Record<NotificationRoute, number> = {
    timeline: 0,
    "operator-watch": 0,
    "action-queue": 0,
    silent: 0,
  };
  const byLevel: Record<NotificationLevel, number> = {
    info: 0,
    warn: 0,
    "action-required": 0,
  };

  for (const item of items) {
    byRoute[item.routedTo] += 1;
    byLevel[item.level] += 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    evaluatedAt: evaluatedAt.toISOString(),
    inQuietHours,
    path: loaded.path,
    issues: loaded.issues,
    policy: loaded.policy,
    counts: {
      input: items.length,
      suppressed: byRoute.silent,
      routed: items.length - byRoute.silent,
      byRoute,
      byLevel,
    },
    items,
  };
}

function normalizePolicy(input: unknown): NotificationPolicyLoadResult {
  const obj = asObject(input);
  const issues: string[] = [];

  const fallback = defaultNotificationPolicy();
  const quietHours = asObject(obj?.quietHours);
  const routing = asObject(obj?.routing);

  const startHour = clampHour(asNumber(quietHours?.startHour), fallback.quietHours.startHour, issues, "quietHours.startHour");
  const endHour = clampHour(asNumber(quietHours?.endHour), fallback.quietHours.endHour, issues, "quietHours.endHour");

  const suppressLevelsRaw = Array.isArray(quietHours?.suppressLevels)
    ? quietHours?.suppressLevels
    : fallback.quietHours.suppressLevels;
  const suppressLevels = normalizeLevels(suppressLevelsRaw, fallback.quietHours.suppressLevels, issues);

  return {
    path: POLICY_PATH,
    policy: {
      quietHours: {
        enabled: asBoolean(quietHours?.enabled, fallback.quietHours.enabled),
        startHour,
        endHour,
        timezoneOffsetMinutes: asFiniteInt(
          quietHours?.timezoneOffsetMinutes,
          fallback.quietHours.timezoneOffsetMinutes,
        ),
        suppressLevels,
      },
      routing: {
        info: normalizeRoute(routing?.info, fallback.routing.info, issues, "routing.info"),
        warn: normalizeRoute(routing?.warn, fallback.routing.warn, issues, "routing.warn"),
        "action-required": normalizeRoute(
          routing?.["action-required"],
          fallback.routing["action-required"],
          issues,
          "routing.action-required",
        ),
      },
    },
    issues,
  };
}

function isInQuietHours(policy: NotificationPolicyConfig, at: Date): boolean {
  if (!policy.quietHours.enabled) return false;

  const minutesUtc = at.getUTCHours() * 60 + at.getUTCMinutes();
  const localMinutes = modulo(minutesUtc + policy.quietHours.timezoneOffsetMinutes, 24 * 60);
  const startMinutes = policy.quietHours.startHour * 60;
  const endMinutes = policy.quietHours.endHour * 60;

  if (startMinutes === endMinutes) return true;
  if (startMinutes < endMinutes) {
    return localMinutes >= startMinutes && localMinutes < endMinutes;
  }

  return localMinutes >= startMinutes || localMinutes < endMinutes;
}

function defaultNotificationPolicy(): NotificationPolicyConfig {
  return {
    quietHours: {
      enabled: true,
      startHour: 23,
      endHour: 8,
      timezoneOffsetMinutes: 0,
      suppressLevels: ["info", "warn"],
    },
    routing: {
      info: "timeline",
      warn: "operator-watch",
      "action-required": "action-queue",
    },
  };
}

function normalizeLevels(input: unknown, fallback: NotificationLevel[], issues: string[]): NotificationLevel[] {
  if (!Array.isArray(input)) return fallback;
  const set = new Set<NotificationLevel>();
  for (const raw of input) {
    if (raw === "info" || raw === "warn" || raw === "action-required") {
      set.add(raw);
    } else {
      issues.push(`Unsupported quietHours.suppressLevels entry: ${String(raw)}`);
    }
  }
  return set.size > 0 ? [...set] : [];
}

function normalizeRoute(
  input: unknown,
  fallback: ExceptionFeedItem["route"],
  issues: string[],
  label: string,
): ExceptionFeedItem["route"] {
  if (input === "timeline" || input === "operator-watch" || input === "action-queue") {
    return input;
  }

  if (input !== undefined) {
    issues.push(`Unsupported ${label}: ${String(input)}`);
  }

  return fallback;
}

function clampHour(input: number | undefined, fallback: number, issues: string[], label: string): number {
  if (input === undefined) return fallback;
  if (input < 0 || input > 23) {
    issues.push(`${label} must be in range 0..23`);
    return fallback;
  }
  return input;
}

function asObject(v: unknown): Record<string, unknown> | undefined {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  return v;
}

function asBoolean(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function asFiniteInt(v: unknown, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.round(v);
}

function modulo(v: number, m: number): number {
  return ((v % m) + m) % m;
}
