import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { SourcingQueueComponent } from './sourcing-queue.component';

describe('SourcingQueueComponent', () => {
  let component: SourcingQueueComponent;
  let fixture: ComponentFixture<SourcingQueueComponent>;

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
    vi.spyOn((component as any).productService, 'search').mockReturnValue(
      of({ data: { content: [] } })
    );

    await component.loadQueue();

    expect(component.items()).toEqual([]);
    expect(component.loadError()).toBeNull();
  });

  it('does not replace an API error with demo queue items', async () => {
    vi.spyOn((component as any).productService, 'search').mockReturnValue(
      throwError(() => new Error('offline'))
    );

    await component.loadQueue();

    expect(component.items()).toEqual([]);
    expect(component.loadError()).toContain('載入失敗');
  });

  it('uses API lead time and masks the stored gap when the driving keyword is unavailable', async () => {
    vi.spyOn((component as any).productService, 'search').mockReturnValue(of({
      data: {
        content: [{
          id: 121,
          name: '韓式草莓糖葫蘆',
          sourcingStatus: 'REJECTED',
          timeGapDays: 11,
        }],
      },
    }));
    vi.spyOn((component as any).sourcingService, 'latest1').mockReturnValue(of({
      data: {
        productId: 121,
        drivingKeywordId: 21,
        leadTimeDays: 45,
        estimatedLifespanDays: undefined,
        timeGapDays: undefined,
      },
    }));

    await component.loadQueue();

    expect(component.items()[0].leadTimeDays).toBe(45);
    expect(component.items()[0].timeGapDays).toBeNull();
    expect(component.formatTimeGap(component.items()[0].timeGapDays)).toBe('—');
  });
});
