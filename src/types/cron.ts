/**
 * Cron Job Type Definitions
 * Types for scheduled tasks
 */

import { ChannelType } from './channel';

/**
 * Cron job target (where to send the result)
 */
export interface CronJobTarget {
  channelType: ChannelType;
  channelId: string;
  channelName: string;
}

export interface CronJobDelivery {
  mode: string;
  channel?: string;
  to?: string;
}

export interface CronPipelinePolicy {
  failureAlertAfter?: number;
  failureAlertCooldownSeconds?: number;
  failureAlertChannel?: string;
  deliveryBestEffort?: boolean;
}

/**
 * Cron job last run info
 */
export interface CronJobLastRun {
  time: string;
  success: boolean;
  error?: string;
  duration?: number;
}

/**
 * Gateway CronSchedule object format
 */
export type CronSchedule =
  | { kind: 'at'; at: string }
  | { kind: 'every'; everyMs: number; anchorMs?: number }
  | { kind: 'cron'; expr: string; tz?: string };

/**
 * Cron job data structure
 * schedule can be a plain cron string or a Gateway CronSchedule object
 */
export interface CronJob {
  id: string;
  name: string;
  message: string;
  schedule: string | CronSchedule;
  target?: CronJobTarget;
  delivery?: CronJobDelivery;
  failureAlertAfter?: number;
  failureAlertCooldownSeconds?: number;
  failureAlertChannel?: string;
  deliveryBestEffort?: boolean;
  sessionTarget?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastRun?: CronJobLastRun;
  nextRun?: string;
}

export type AgentCronRelationReason = 'session-target' | 'channel-type' | 'default-session-target';

export interface AgentCronRelation {
  job: CronJob;
  relationReason: AgentCronRelationReason;
  deepLink: string;
}

/**
 * Input for creating a cron job from the UI.
 * No target/delivery — UI-created tasks push results to the ClawCorp chat page.
 * Tasks created via external channels are handled directly by the Gateway.
 */
export interface CronJobCreateInput {
  name: string;
  message: string;
  schedule: string;
  enabled?: boolean;
  delivery?: CronJobDelivery;
  failureAlertAfter?: number;
  failureAlertCooldownSeconds?: number;
  failureAlertChannel?: string;
  deliveryBestEffort?: boolean;
}

/**
 * Input for updating a cron job
 */
export interface CronJobUpdateInput {
  name?: string;
  message?: string;
  schedule?: string;
  enabled?: boolean;
  delivery?: CronJobDelivery;
  failureAlertAfter?: number;
  failureAlertCooldownSeconds?: number;
  failureAlertChannel?: string;
  deliveryBestEffort?: boolean;
}

/**
 * Schedule type for UI picker
 */
export type ScheduleType = 'daily' | 'weekly' | 'monthly' | 'interval' | 'custom';
