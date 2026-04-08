import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeedbackState } from '@/components/common/FeedbackState';

describe('FeedbackState', () => {
  it('renders loading state content', () => {
    render(<FeedbackState state="loading" title="Loading data" description="Please wait" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading data')).toBeInTheDocument();
    expect(screen.getByText('Please wait')).toBeInTheDocument();
  });

  it('renders action for empty state and supports start alignment', () => {
    render(
      <FeedbackState
        state="empty"
        title="Nothing here"
        align="start"
        action={<button type="button">Create one</button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Create one' })).toBeInTheDocument();
    expect(screen.getByText('Nothing here').closest('div')).toHaveClass('items-start');
  });

  it('renders custom icon and uses alert semantics for errors', () => {
    render(
      <FeedbackState
        state="error"
        title="Request failed"
        icon={<span data-testid="custom-icon">!</span>}
      />,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    expect(screen.getByText('Request failed')).toBeInTheDocument();
  });
});
