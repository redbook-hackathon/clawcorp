import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsMemoryStrategy } from '@/components/settings-center/settings-memory-strategy';

describe('SettingsMemoryStrategy', () => {
  it('renders the strategy sections and local knowledge controls', () => {
    render(<SettingsMemoryStrategy />);

    expect(screen.getByRole('heading', { name: '全局长期记忆策略' })).toBeInTheDocument();
    expect(screen.getByText('Local SQLite + BM25 全文检索 (默认最轻量)')).toBeInTheDocument();
    expect(screen.getByText('text-embedding-3-small (OpenAI, 高性价比)')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: '自动浓缩与总结' })).toBeInTheDocument();
    expect(screen.getByText(/多轮对话自动滚动压缩/)).toBeInTheDocument();
    expect(screen.getByText(/每日复盘生成/)).toBeInTheDocument();
    expect(screen.getAllByRole('switch')).toHaveLength(2);

    expect(screen.getByRole('heading', { name: '挂载本地目录知识' })).toBeInTheDocument();
    expect(screen.getByText('D:/CompanyDocs/Handbook')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重做索引' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ 添加本地监控目录集/ })).toBeInTheDocument();
  });
});
