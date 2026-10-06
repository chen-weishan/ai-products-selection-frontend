import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { SourcingQueueComponent } from './sourcing-queue.component';
import { SKIP_GLOBAL_LOADING } from '../../core/http/loading-interceptor';

describe('SourcingQueueComponent', () => {
  let component: SourcingQueueComponent;
  let fixture: ComponentFixture<SourcingQueueComponent>;

  const queuePage = (content: any[] = [], overrides: any = {}) => ({
    content,
    page: 0,
    size: 10,
    totalElements: content.length,
    totalPages: content.length ? 1 : 0,
    summary: { activeCount: 0, rejectedCount: 0, promotedCount: 0 },
    ...overrides,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SourcingQueueComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SourcingQueueComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps the real queue empty when the backend returns no B-track products', async () => {
    vi.spyOn((component as any).queueService, 'getQueue').mockReturnValue(of(queuePage()));

    await component.loadQueue();

    expect(component.items()).toEqual([]);
    expect(component.loadError()).toBeNull();
  });

  it('does not replace an API error with demo queue items', async () => {
    vi.spyOn((component as any).queueService, 'getQueue').mockReturnValue(
      throwError(() => new Error('offline'))
    );

    await component.loadQueue();

    expect(component.items()).toEqual([]);
    expect(component.loadError()).toContain('載入失敗');
  });

  it('uses the batch API fields and summary without requesting individual reports', async () => {
    vi.spyOn((component as any).queueService, 'getQueue').mockReturnValue(of(queuePage([
        {
          id: 121,
          productId: 121,
          name: '韓式草莓糖葫蘆',
          keyword: '韓式草莓糖葫蘆',
          sourcingStatus: 'REJECTED',
          leadTimeDays: 45,
          timeGapDays: null,
        },
      ], {
        totalElements: 26,
        summary: { activeCount: 15, rejectedCount: 8, promotedCount: 3 },
      })));
    const latest = vi.spyOn((component as any).sourcingService, 'latest1');

    await component.loadQueue();

    expect(component.items()[0].leadTimeDays).toBe(45);
    expect(component.items()[0].timeGapDays).toBeNull();
    expect(component.totalElements()).toBe(26);
    expect(component.activeCount()).toBe(15);
    expect(component.rejectedCount()).toBe(8);
    expect(component.promotedCount()).toBe(3);
    expect(latest).not.toHaveBeenCalled();
  });

  it('only enables prioritizing a pending item with a non-negative time gap', () => {
    const base = { productId: 1, keyword: '候選', sourcingStatus: 'PENDING' } as const;

    expect(component.canAddToSourcingQueue({ ...base, timeGapDays: null })).toBe(false);
    expect(component.canAddToSourcingQueue({ ...base, timeGapDays: -1 })).toBe(false);
    expect(component.canAddToSourcingQueue({ ...base, timeGapDays: 0 })).toBe(true);
    expect(component.canAddToSourcingQueue({ ...base, sourcingStatus: 'SOURCING', timeGapDays: 8 })).toBe(false);
  });

  it('allows active and rejected items to be saved as watching regardless of time gap', () => {
    const item = (sourcingStatus: string, timeGapDays: number | null) => ({
      productId: 1,
      keyword: '候選',
      sourcingStatus,
      timeGapDays,
    });

    expect(component.canSaveAsWatching(item('URGENT', null))).toBe(true);
    expect(component.canSaveAsWatching(item('SOURCING', -5))).toBe(true);
    expect(component.canSaveAsWatching(item('REJECTED', -20))).toBe(true);
    expect(component.canSaveAsWatching(item('PENDING', 10))).toBe(false);
  });

  it('calls the matching action API and refreshes the single batch endpoint', async () => {
    const sourcingService = (component as any).sourcingService;
    const prioritize = vi.spyOn(sourcingService, 'prioritize').mockReturnValue(of({
      data: { productId: 11, sourcingStatus: 'URGENT', timeGapDays: 0 },
    }));
    const watch = vi.spyOn(sourcingService, 'watch').mockReturnValue(of({
      data: { productId: 12, sourcingStatus: 'PENDING', timeGapDays: -5 },
    }));
    const getQueue = vi.spyOn((component as any).queueService, 'getQueue')
      .mockReturnValue(of(queuePage()));
    const invalidateCache = vi.spyOn((component as any).queueService, 'invalidateCache');

    await component.addToSourcingQueue({
      productId: 11,
      keyword: '待評估候選',
      sourcingStatus: 'PENDING',
      timeGapDays: 0,
    });
    await component.saveAsWatching({
      productId: 12,
      keyword: '已淘汰候選',
      sourcingStatus: 'REJECTED',
      timeGapDays: -5,
    });

    expect(prioritize).toHaveBeenCalledWith(
      { productId: 11 },
      'body',
      false,
      expect.objectContaining({ context: expect.anything() }),
    );
    expect(watch).toHaveBeenCalledWith(
      { productId: 12 },
      'body',
      false,
      expect.objectContaining({ context: expect.anything() }),
    );
    expect((prioritize.mock.calls[0][3] as any)?.context?.get(SKIP_GLOBAL_LOADING)).toBe(true);
    expect((watch.mock.calls[0][3] as any)?.context?.get(SKIP_GLOBAL_LOADING)).toBe(true);
    expect(getQueue).toHaveBeenCalledTimes(2);
    expect(getQueue).toHaveBeenNthCalledWith(1, 'ALL', 0, 10, true);
    expect(getQueue).toHaveBeenNthCalledWith(2, 'ALL', 0, 10, true);
    expect(invalidateCache).toHaveBeenCalledTimes(2);
    expect(component.pendingProductId()).toBeNull();
  });

  it('sends the current server-side page and filter in one request', async () => {
    const getQueue = vi.spyOn((component as any).queueService, 'getQueue')
      .mockReturnValue(of(queuePage()));
    component.selectedStatus.set('REJECTED');
    component.pageIndex.set(2);
    component.pageSize.set(20);
    await component.loadQueue();

    expect(getQueue).toHaveBeenCalledOnce();
    expect(getQueue).toHaveBeenCalledWith('REJECTED', 2, 20);
  });
});
