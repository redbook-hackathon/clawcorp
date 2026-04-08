/**
 * Tests for TaskKanban view toggle
 * Phase 02 Plan 02 Task 3
 */
import { describe, it, expect } from 'vitest';
import zhCommon from '@/i18n/locales/zh/common.json';
import enCommon from '@/i18n/locales/en/common.json';

describe('TaskKanban view toggle', () => {
  it('i18n keys exist for view toggle in Chinese', () => {
    // Assert
    expect(zhCommon.kanban.views.board).toBe('看板');
    expect(zhCommon.kanban.views.calendar).toBe('日程');
  });

  it('i18n keys exist for view toggle in English', () => {
    // Assert
    expect(enCommon.kanban.views.board).toBe('Board');
    expect(enCommon.kanban.views.calendar).toBe('Calendar');
  });

  it('CalendarView component can be imported', async () => {
    // Act
    const { CalendarView } = await import('@/pages/TaskKanban/CalendarView');

    // Assert
    expect(CalendarView).toBeDefined();
    expect(typeof CalendarView).toBe('function');
  });

  it('TaskKanban component can be imported', async () => {
    // Act
    const TaskKanban = await import('@/pages/TaskKanban/index');

    // Assert
    expect(TaskKanban.default).toBeDefined();
    expect(typeof TaskKanban.default).toBe('function');
  });
});
