import { describe, expect, it } from 'vitest';
import {
  getChatInputSlashMatches,
  isSlashCommandPrefixInput,
  parseChatInputSlashCommand,
} from '@/pages/Chat/slash-commands';

describe('chat input slash commands', () => {
  it('detects slash prefix input before args are entered', () => {
    expect(isSlashCommandPrefixInput('/')).toBe(true);
    expect(isSlashCommandPrefixInput('/ag')).toBe(true);
    expect(isSlashCommandPrefixInput('/agent research')).toBe(false);
    expect(isSlashCommandPrefixInput('hello')).toBe(false);
  });

  it('matches all commands for bare slash', () => {
    const matches = getChatInputSlashMatches('/');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((command) => command.name === '/new')).toBe(true);
    expect(matches.some((command) => command.name === '/agent')).toBe(true);
  });

  it('matches commands by prefix', () => {
    const matches = getChatInputSlashMatches('/ag');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.name).toBe('/agent');
  });

  it('parses slash commands with either space or colon separators', () => {
    expect(parseChatInputSlashCommand('/agent research')).toMatchObject({
      command: { key: 'agent' },
      args: 'research',
    });
    expect(parseChatInputSlashCommand('/cwd:C:/tmp/work')).toMatchObject({
      command: { key: 'cwd' },
      args: 'C:/tmp/work',
    });
  });

  it('returns null for unknown slash commands', () => {
    expect(parseChatInputSlashCommand('/status')).toBeNull();
  });
});
