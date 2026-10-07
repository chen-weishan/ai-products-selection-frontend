import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { SourcingComponent } from './sourcing.component';

describe('SourcingComponent', () => {
  let component: SourcingComponent;
  let fixture: ComponentFixture<SourcingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SourcingComponent],
      providers: [provideRouter([]), provideHttpClient()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(SourcingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses the backend capability when time gap is missing', () => {
    expect(component.canAddToSourcingQueue({
      timeGapDays: undefined,
      sourcingStatus: 'PENDING',
      canPrioritize: false,
    })).toBe(false);
  });

  it('rejects a negative gap even when a stale backend capability says it is allowed', () => {
    expect(component.canAddToSourcingQueue({
      timeGapDays: -1,
      sourcingStatus: 'PENDING',
      canPrioritize: true,
    })).toBe(false);
  });

  it('does not second-guess a stale or rejected response with a non-null gap', () => {
    expect(component.canAddToSourcingQueue({
      timeGapDays: 20,
      sourcingStatus: 'SOURCING',
      canPrioritize: false,
      prioritizeDisabledReason: '時效落差不是當日最新資料。',
    })).toBe(false);
    expect(component.canAddToSourcingQueue({
      timeGapDays: -1,
      sourcingStatus: 'REJECTED',
      canPrioritize: false,
    })).toBe(false);
  });

  it('allows a raw stranger result to be saved as watching', () => {
    expect(component.canSaveAsWatching({
      itemId: 731,
      productId: undefined,
      canWatch: true,
      canPrioritize: false,
    })).toBe(true);
  });

  it('disables both commands while an action is pending', () => {
    component.isActionPending.set(true);
    expect(component.canSaveAsWatching({ canWatch: true })).toBe(false);
    expect(component.canAddToSourcingQueue({ canPrioritize: true })).toBe(false);
  });

  it('loads a stranger-word result by itemId when the completed task has no productId', async () => {
    vi.useFakeTimers();
    const aiTasksService = (component as any).aiTasksService;
    const sourcingService = (component as any).sourcingService;
    vi.spyOn(aiTasksService, 'get5').mockReturnValue(of({ data: { status: 'SUCCEEDED' } }));
    vi.spyOn(aiTasksService, 'items').mockReturnValue(of({
      data: [{ itemId: 731, scoutKeyword: '陌生字詞', scoutCategoryId: 12 }],
    }));
    const latestResult = vi.spyOn(sourcingService, 'latestResult').mockReturnValue(of({
      data: { itemId: 731, report: '陌生字詞尋源結果', canWatch: true, canPrioritize: false },
    }));
    vi.spyOn(component, 'fetchBudget').mockImplementation(() => undefined);

    try {
      (component as any).pollAiTask(99);
      await vi.advanceTimersByTimeAsync(5000);

      expect(latestResult).toHaveBeenCalledWith({ itemId: 731 });
      expect(component.scoutReport()?.itemId).toBe(731);
      expect(component.scoutError()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses raw-result commands for stranger words without a productId', async () => {
    const sourcingService = (component as any).sourcingService;
    const watchResult = vi.spyOn(sourcingService, 'watchResult').mockReturnValue(of({
      data: { itemId: 731, productId: 901, canWatch: false, canPrioritize: true },
    }));
    const prioritizeResult = vi.spyOn(sourcingService, 'prioritizeResult').mockReturnValue(of({
      data: { itemId: 732, productId: 902, sourcingStatus: 'URGENT' },
    }));
    const watch = vi.spyOn(sourcingService, 'watch');
    const prioritize = vi.spyOn(sourcingService, 'prioritize');
    vi.spyOn((component as any).dialogService, 'Confirm').mockReturnValue(of(true));

    component.saveAsWatching({ itemId: 731, canWatch: true, canPrioritize: false });
    await Promise.resolve();
    component.addToSourcingQueue({
      itemId: 732,
      timeGapDays: 7,
      canWatch: true,
      canPrioritize: true,
    });
    await Promise.resolve();

    expect(watchResult).toHaveBeenCalledWith({ itemId: 731 });
    expect(prioritizeResult).toHaveBeenCalledWith({ itemId: 732 });
    expect(watch).not.toHaveBeenCalled();
    expect(prioritize).not.toHaveBeenCalled();
  });
});
