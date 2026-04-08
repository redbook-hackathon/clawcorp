import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import MarkdownContent from '@/pages/Chat/MarkdownContent';

describe('MarkdownContent chemistry and math rendering', () => {
  it('renders inline code with existing styling behavior', () => {
    render(<MarkdownContent content={'Use `trace_id` for correlation.'} />);

    const code = screen.getByText('trace_id');
    expect(code.tagName.toLowerCase()).toBe('code');
    expect(code).toHaveClass('inline');
  });

  it('renders standard display math through KaTeX', () => {
    const { container } = render(<MarkdownContent content={'$$\nE = mc^2\n$$'} />);

    expect(container.querySelector('.katex-display')).not.toBeNull();
  });

  it('renders mhchem chemistry syntax through KaTeX without parse errors', () => {
    const { container } = render(<MarkdownContent content={'$\\ce{H2O}$'} />);
    const visibleMathText = container.querySelector('.katex-html')?.textContent ?? '';

    expect(container.querySelector('.katex')).not.toBeNull();
    expect(visibleMathText).not.toContain('\\ce');
  });
});
