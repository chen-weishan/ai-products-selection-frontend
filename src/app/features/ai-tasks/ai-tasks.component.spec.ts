import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AiTasksComponent } from './ai-tasks.component';
import {
  AITasksService,
  AiBudgetControllerService,
  AiTaskResponse,
  AiTaskSummaryResponse,
  Snapshot,
} from '../../api';
import { DialogService } from '../../services/dialog-service';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

describe('AiTasksComponent', () => {
  let component: AiTasksComponent;
  let fixture: ComponentFixture<AiTasksComponent>;

  let mockAiTasksService: {
    summary1: ReturnType<typeof vi.fn>;
    list1: ReturnType<typeof vi.fn>;
    items: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
    retryFailed: ReturnType<typeof vi.fn>;
    create2: ReturnType<typeof vi.fn>;
  };

  let mockAiBudgetService: {
    current: ReturnType<typeof vi.fn>;
  };

  let mockDialogService: {
    Confirm: ReturnType<typeof vi.fn>;
  };

  let mockMatDialog: {
    open: ReturnType<typeof vi.fn>;
  };

  let mockSnackBar: {
    open: ReturnType<typeof vi.fn>;
  };

  const sampleSummary: AiTaskSummaryResponse = {
    runningCount: 1,
    monthlyCompletedCount: 42,
    failedCount: 2,
  };

  const sampleBudget: Snapshot = {
    dailyQuota: 1000,
    resetAt: '00:00 UTC+8',
    resetSource: '系統排程',
    pools: [
      { pool: 'TRACK_A', share: 0.7, limit: 700, used: 120, cacheHits: 35, status: 'OK' },
      { pool: 'TRACK_B', share: 0.2, limit: 200, used: 45, cacheHits: 12, status: 'OK' },
      { pool: 'RETRY', share: 0.1, limit: 100, used: 15, cacheHits: 4, status: 'OK' },
    ],
  };

  const sampleTasks: AiTaskResponse[] = [
    {
      taskId: 101,
      taskType: 'FULL_ANALYSIS',
      taskTypeDisplayName: '全量綜合分析',
      budgetPool: 'TRACK_A',
      status: 'RUNNING',
      totalCount: 10,
      successCount: 4,
      failCount: 0,
      cacheHitCount: 2,
      requestCount: 8,
      progressPercent: 40,
      startedAt: '2026-09-26T10:00:00Z',
    },
    {
      taskId: 100,
      taskType: 'REVIEW_RISK',
      taskTypeDisplayName: '評論與負評風險',
      budgetPool: 'TRACK_A',
      status: 'PARTIAL',
      totalCount: 5,
      successCount: 4,
      failCount: 1,
      cacheHitCount: 0,
      requestCount: 5,
      progressPercent: 100,
      startedAt: '2026-09-26T09:00:00Z',
      finishedAt: '2026-09-26T09:05:00Z',
    },
  ];

  beforeEach(async () => {
    mockAiTasksService = {
      summary1: vi.fn().mockReturnValue(of({ success: true, data: sampleSummary })),
      list1: vi.fn().mockReturnValue(of({ success: true, data: { content: sampleTasks, totalElements: 2 } })),
      items: vi.fn().mockReturnValue(of({ success: true, data: [{ itemId: 1, productId: 501, status: 'SUCCEEDED', durationMs: 120 }] })),
      cancel: vi.fn().mockReturnValue(of({ success: true, data: { ...sampleTasks[0], status: 'CANCELLED' } })),
      retryFailed: vi.fn().mockReturnValue(of({ success: true, data: { taskId: 102, status: 'PENDING' } })),
      create2: vi.fn().mockReturnValue(of({ success: true, data: { taskId: 103, status: 'PENDING', taskType: 'FULL_ANALYSIS' } })),
    };

    mockAiBudgetService = {
      current: vi.fn().mockReturnValue(of({ success: true, data: sampleBudget })),
    };

    mockDialogService = {
      Confirm: vi.fn().mockReturnValue(of(true)),
    };

    mockMatDialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(null),
      }),
    };

    mockSnackBar = {
      open: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AiTasksComponent],
      providers: [
        provideAnimationsAsync(),
        { provide: AITasksService, useValue: mockAiTasksService },
        { provide: AiBudgetControllerService, useValue: mockAiBudgetService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: MatDialog, useValue: mockMatDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AiTasksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('should create and load initial summary, budget, and tasks', () => {
    expect(component).toBeTruthy();
    expect(mockAiTasksService.summary1).toHaveBeenCalled();
    expect(mockAiBudgetService.current).toHaveBeenCalled();
    expect(mockAiTasksService.list1).toHaveBeenCalled();

    expect(component.summary()).toEqual(sampleSummary);
    expect(component.budget()).toEqual(sampleBudget);
    expect(component.tasks().length).toBe(2);
    expect(component.totalCount()).toBe(2);
  });

  it('should compute activeRunningTask and isAnyRunning correctly', () => {
    expect(component.activeRunningTask()?.taskId).toBe(101);
    expect(component.isAnyRunning()).toBe(true);
  });

  it('should filter tasks by status', () => {
    component.onStatusFilterChange('FAILED');
    expect(component.selectedStatus()).toBe('FAILED');
    expect(component.pageIndex()).toBe(0);
    expect(mockAiTasksService.list1).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', page: 0, size: 10 }),
      'body',
      false,
      expect.anything()
    );
  });

  it('should toggle and load task items', () => {
    component.toggleTaskItems(101);
    expect(component.expandedTaskId()).toBe(101);
    expect(mockAiTasksService.items).toHaveBeenCalledWith({ taskId: 101 }, 'body', false, expect.anything());

    // Toggle again to collapse
    component.toggleTaskItems(101);
    expect(component.expandedTaskId()).toBeNull();
  });

  it('should cancel running task with confirmation', () => {
    const runningTask = sampleTasks[0];
    component.cancelTask(runningTask);

    expect(mockDialogService.Confirm).toHaveBeenCalledWith(
      expect.objectContaining({ isDanger: true })
    );
    expect(mockAiTasksService.cancel).toHaveBeenCalledWith({ taskId: 101 });
    expect(mockSnackBar.open).toHaveBeenCalledWith(expect.stringContaining('成功取消'), '關閉', expect.anything());
  });

  it('should retry failed items with confirmation', () => {
    const failedTask = sampleTasks[1];
    component.retryFailed(failedTask);

    expect(mockDialogService.Confirm).toHaveBeenCalledWith(
      expect.objectContaining({ confirmText: '確認重跑' })
    );
    expect(mockAiTasksService.retryFailed).toHaveBeenCalledWith({ taskId: 100 });
    expect(mockSnackBar.open).toHaveBeenCalledWith(expect.stringContaining('已建立重試任務 #102'), '關閉', expect.anything());
  });

  it('should open create task dialog and trigger creation on submit', () => {
    mockMatDialog.open.mockReturnValue({
      afterClosed: () =>
        of({
          taskType: 'FULL_ANALYSIS',
          productIds: [101, 102],
          forceRefresh: true,
        }),
    });

    component.openCreateDialog();

    expect(mockMatDialog.open).toHaveBeenCalled();
    expect(mockAiTasksService.create2).toHaveBeenCalledWith({
      createAiTaskRequest: {
        taskType: 'FULL_ANALYSIS',
        productIds: [101, 102],
        options: { forceRefresh: true },
      },
    });
    expect(mockSnackBar.open).toHaveBeenCalledWith(expect.stringContaining('已成功建立 AI 任務 #103'), '關閉', expect.anything());
  });

  it('should calculate budget pool percentage and duration correctly', () => {
    const trackAPct = component.getPoolPercent('TRACK_A');
    expect(trackAPct).toBe(17); // 120 / 700 * 100 = 17.14 -> 17%

    const duration = component.calculateDuration('2026-09-26T10:00:00Z', '2026-09-26T10:02:15Z');
    expect(duration).toBe('2 分 15 秒');
  });
});
