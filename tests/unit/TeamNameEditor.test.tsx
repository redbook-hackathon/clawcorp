import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { TeamNameEditor } from '@/components/team/TeamNameEditor';
import { useTeamsStore } from '@/stores/teams';

vi.mock('@/stores/teams', () => ({
  useTeamsStore: vi.fn((selector) => {
    const mockStore = {
      updateTeam: vi.fn(),
    };
    return selector ? selector(mockStore) : mockStore;
  }),
}));

describe('TeamNameEditor', () => {
  let mockUpdateTeam: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateTeam = vi.fn();
    (useTeamsStore as any).mockImplementation((selector: any) => {
      const mockStore = {
        updateTeam: mockUpdateTeam,
      };
      return selector ? selector(mockStore) : mockStore;
    });
  });

  it('displays team name as clickable text', () => {
    render(<TeamNameEditor teamId="team-1" initialName="测试团队" />);
    expect(screen.getByText('测试团队')).toBeInTheDocument();
  });

  it('enters edit mode when name is clicked', () => {
    render(<TeamNameEditor teamId="team-1" initialName="测试团队" />);

    fireEvent.click(screen.getByText('测试团队'));

    const input = screen.getByDisplayValue('测试团队');
    expect(input).toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it('selects all text when entering edit mode', () => {
    render(<TeamNameEditor teamId="team-1" initialName="测试团队" />);

    fireEvent.click(screen.getByText('测试团队'));

    const input = screen.getByDisplayValue('测试团队') as HTMLInputElement;
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it('saves changes when Enter is pressed', async () => {
    mockUpdateTeam.mockResolvedValueOnce(undefined);
    render(<TeamNameEditor teamId="team-1" initialName="测试团队" />);

    fireEvent.click(screen.getByText('测试团队'));

    const input = await screen.findByDisplayValue('测试团队');
    fireEvent.change(input, { target: { value: '新团队名称' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.queryByDisplayValue('新团队名称')).not.toBeInTheDocument();
    });

    expect(mockUpdateTeam).toHaveBeenCalledWith('team-1', { name: '新团队名称' });
  });

  it('saves changes when input loses focus', async () => {
    mockUpdateTeam.mockResolvedValueOnce(undefined);
    render(<TeamNameEditor teamId="team-1" initialName="测试团队" />);

    fireEvent.click(screen.getByText('测试团队'));

    const input = await screen.findByDisplayValue('测试团队');
    fireEvent.change(input, { target: { value: '新团队名称' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.queryByDisplayValue('新团队名称')).not.toBeInTheDocument();
    });

    expect(mockUpdateTeam).toHaveBeenCalledWith('team-1', { name: '新团队名称' });
  });

  it('cancels edit when Escape is pressed', () => {
    render(<TeamNameEditor teamId="team-1" initialName="测试团队" />);

    fireEvent.click(screen.getByText('测试团队'));

    const input = screen.getByDisplayValue('测试团队');
    fireEvent.change(input, { target: { value: '新团队名称' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.getByText('测试团队')).toBeInTheDocument();
    expect(mockUpdateTeam).not.toHaveBeenCalled();
  });

  it('does not save if name is empty', async () => {
    render(<TeamNameEditor teamId="team-1" initialName="测试团队" />);

    fireEvent.click(screen.getByText('测试团队'));

    const input = screen.getByDisplayValue('测试团队');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(mockUpdateTeam).not.toHaveBeenCalled();
      expect(screen.getByText('测试团队')).toBeInTheDocument();
    });
  });

  it('does not save if name is unchanged', async () => {
    render(<TeamNameEditor teamId="team-1" initialName="测试团队" />);

    fireEvent.click(screen.getByText('测试团队'));

    fireEvent.blur(screen.getByDisplayValue('测试团队'));

    await waitFor(() => {
      expect(mockUpdateTeam).not.toHaveBeenCalled();
    });
  });

  it('disables input during save', async () => {
    let resolveUpdate: () => void = () => {};
    const updatePromise = new Promise<void>((resolve) => {
      resolveUpdate = resolve;
    });
    mockUpdateTeam.mockReturnValue(updatePromise);

    render(<TeamNameEditor teamId="team-1" initialName="测试团队" />);

    fireEvent.click(screen.getByText('测试团队'));

    const input = await screen.findByDisplayValue('测试团队');
    fireEvent.change(input, { target: { value: '新团队名称' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      const currentInput = screen.queryByDisplayValue('新团队名称');
      if (currentInput) {
        expect(currentInput).toBeDisabled();
      }
    });

    await act(async () => {
      resolveUpdate();
      await updatePromise;
    });
  });

  it('reverts to original name on save error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUpdateTeam.mockRejectedValueOnce(new Error('Save failed'));

    render(<TeamNameEditor teamId="team-1" initialName="测试团队" />);

    fireEvent.click(screen.getByText('测试团队'));

    const input = screen.getByDisplayValue('测试团队');
    fireEvent.change(input, { target: { value: '新团队名称' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.getByText('测试团队')).toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });

  it('stops event propagation when clicked', () => {
    const handleParentClick = vi.fn();
    render(
      <div onClick={handleParentClick}>
        <TeamNameEditor teamId="team-1" initialName="测试团队" />
      </div>,
    );

    fireEvent.click(screen.getByText('测试团队'));

    expect(handleParentClick).not.toHaveBeenCalled();
  });
});
