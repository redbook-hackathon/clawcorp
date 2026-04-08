import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FeedbackBanner } from '@/components/common/FeedbackBanner';

describe('FeedbackBanner', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders title, description and action content', () => {
    render(
      <FeedbackBanner
        bannerId="sync-warning"
        title="Sync is delayed"
        description="Last fetch was more than 5 minutes ago."
        action={<button type="button">Retry</button>}
      />,
    );

    expect(screen.getByText('Sync is delayed')).toBeInTheDocument();
    expect(screen.getByText('Last fetch was more than 5 minutes ago.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('persists dismissal state by banner id', () => {
    const { rerender } = render(
      <FeedbackBanner bannerId="activity-error" title="Could not refresh activity log" />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss feedback' }));
    expect(screen.queryByText('Could not refresh activity log')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('clawx:feedback-banner:activity-error')).toBe('dismissed');

    rerender(<FeedbackBanner bannerId="activity-error" title="Could not refresh activity log" />);
    expect(screen.queryByText('Could not refresh activity log')).not.toBeInTheDocument();
  });
});
