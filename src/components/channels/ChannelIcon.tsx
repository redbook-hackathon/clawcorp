/**
 * ChannelIcon - Brand SVG icons for messaging channels
 * Falls back to emoji for channels without a dedicated SVG.
 */
import { cn } from '@/lib/utils';
import dingtalkIcon from '@/assets/channels/dingtalk.svg';
import discordIcon from '@/assets/channels/discord.svg';
import feishuIcon from '@/assets/channels/feishu.svg';
import qqIcon from '@/assets/channels/qq.svg';
import telegramIcon from '@/assets/channels/telegram.svg';
import wecomIcon from '@/assets/channels/wecom.svg';
import whatsappIcon from '@/assets/channels/whatsapp.svg';
import type { ChannelType } from '@/types/channel';

const CHANNEL_SVG_MAP: Partial<Record<ChannelType, string>> = {
  dingtalk: dingtalkIcon,
  discord: discordIcon,
  feishu: feishuIcon,
  qqbot: qqIcon,
  telegram: telegramIcon,
  wecom: wecomIcon,
  whatsapp: whatsappIcon,
};

const CHANNEL_EMOJI_FALLBACK: Record<ChannelType, string> = {
  whatsapp: '📱',
  dingtalk: '💬',
  telegram: '✈️',
  discord: '🎮',
  signal: '🔒',
  feishu: '🐦',
  wecom: '💼',
  imessage: '💬',
  matrix: '🔗',
  line: '🟢',
  msteams: '👔',
  googlechat: '💭',
  mattermost: '💠',
  qqbot: '🐧',
  wechat: '💬',
};

interface ChannelIconProps {
  type: ChannelType;
  size?: number;
  className?: string;
}

export function ChannelIcon({ type, size = 18, className }: ChannelIconProps) {
  const iconSrc = CHANNEL_SVG_MAP[type];

  if (iconSrc) {
    return (
      <img
        src={iconSrc}
        alt={`${type} icon`}
        className={cn('shrink-0 object-contain', className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={cn('shrink-0 leading-none', className)}
      style={{ fontSize: size }}
    >
      {CHANNEL_EMOJI_FALLBACK[type] ?? '🔌'}
    </span>
  );
}
