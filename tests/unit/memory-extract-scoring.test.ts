// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  extractMemoryFromMessages,
  clearLlmJudgeCache,
  type MemoryExtractMessage,
} from '@electron/api/routes/memory-extract';

function msgs(...texts: string[]): MemoryExtractMessage[] {
  return texts.map((t) => ({ role: 'user', content: t }));
}

describe('memory-extract scoring engine', () => {
  it('accepts profile statements with high confidence', async () => {
    const result = await extractMemoryFromMessages(msgs('我叫李雷'));
    expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    expect(result.candidates[0].reason).toBe('implicit:profile');
    expect(result.candidates[0].confidence).toBeGreaterThan(0.7);
  });

  it('accepts ownership statements', async () => {
    const result = await extractMemoryFromMessages(msgs('我养了一只猫叫小花'));
    expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    expect(result.candidates[0].reason).toBe('implicit:ownership');
  });

  it('accepts preference statements', async () => {
    const result = await extractMemoryFromMessages(msgs('I usually code in TypeScript'));
    expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    expect(result.candidates[0].reason).toBe('implicit:preference');
  });

  it('accepts assistant style preferences', async () => {
    const result = await extractMemoryFromMessages(msgs('以后请默认用英文回答'));
    expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    expect(result.candidates[0].reason).toBe('implicit:assistant-style');
  });

  it('rejects procedural/command text', async () => {
    const result = await extractMemoryFromMessages(msgs('帮我看看这个 npm install 报错怎么修复'));
    expect(result.candidates.length).toBe(0);
  });

  it('rejects questions', async () => {
    const result = await extractMemoryFromMessages(msgs('请问如何配置 TypeScript？'));
    expect(result.candidates.length).toBe(0);
  });

  it('rejects small talk', async () => {
    const result = await extractMemoryFromMessages(msgs('好的'));
    expect(result.candidates.length).toBe(0);
  });

  it('rejects transient context', async () => {
    const result = await extractMemoryFromMessages(msgs('今天我在调试一个 bug'));
    expect(result.candidates.length).toBe(0);
  });

  it('handles explicit add commands', async () => {
    const result = await extractMemoryFromMessages(msgs('记住我喜欢用 Vim'));
    expect(result.candidates.length).toBe(1);
    expect(result.candidates[0].explicit).toBe(true);
    expect(result.candidates[0].action).toBe('add');
  });

  it('handles explicit delete commands', async () => {
    const result = await extractMemoryFromMessages(msgs('忘掉我喜欢用 Vim'));
    expect(result.candidates.length).toBe(1);
    expect(result.candidates[0].explicit).toBe(true);
    expect(result.candidates[0].action).toBe('delete');
  });

  it('deduplicates identical candidates', async () => {
    const result = await extractMemoryFromMessages(msgs('我叫李雷', '我叫李雷'));
    expect(result.candidates.length).toBe(1);
  });

  it('respects maxCandidates option', async () => {
    const result = await extractMemoryFromMessages(
      msgs('我叫李雷。我养了一只猫。我喜欢 TypeScript。以后请默认用英文回答。'),
      { maxCandidates: 2 },
    );
    expect(result.candidates.length).toBeLessThanOrEqual(2);
  });

  it('clearLlmJudgeCache does not throw', () => {
    expect(() => clearLlmJudgeCache()).not.toThrow();
  });
});
