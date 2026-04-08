export const UI_WECHAT_CHANNEL_TYPE = 'wechat';
export const OPENCLAW_WECHAT_CHANNEL_TYPE = 'openclaw-weixin';
const BLOCKED_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const VALID_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const INVALID_CHARS_RE = /[^a-z0-9_-]+/g;
const LEADING_DASH_RE = /^-+/;
const TRAILING_DASH_RE = /-+$/;

export function toOpenClawChannelType(channelType: string): string {
  return channelType === UI_WECHAT_CHANNEL_TYPE ? OPENCLAW_WECHAT_CHANNEL_TYPE : channelType;
}

export function toUiChannelType(channelType: string): string {
  return channelType === OPENCLAW_WECHAT_CHANNEL_TYPE ? UI_WECHAT_CHANNEL_TYPE : channelType;
}

export function isWechatChannelType(channelType: string | null | undefined): boolean {
  return channelType === UI_WECHAT_CHANNEL_TYPE || channelType === OPENCLAW_WECHAT_CHANNEL_TYPE;
}

export function normalizeOpenClawAccountId(value: string | null | undefined, fallback = 'default'): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return fallback;
  const normalized = VALID_ID_RE.test(trimmed)
    ? trimmed.toLowerCase()
    : trimmed
      .toLowerCase()
      .replace(INVALID_CHARS_RE, '-')
      .replace(LEADING_DASH_RE, '')
      .replace(TRAILING_DASH_RE, '')
      .slice(0, 64);
  if (!normalized || BLOCKED_OBJECT_KEYS.has(normalized)) {
    return fallback;
  }
  return normalized;
}
