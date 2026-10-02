import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ProductReferenceControllerService, TrendControllerService, TrendSignalRow } from '../../api';
import { AuthService } from '../../core/auth/auth.service';
import { DialogService } from '../../services/dialog-service';
import { TrendsComponent } from './trends.component';

describe('TrendsComponent', () => {
  let component: TrendsComponent;
  let fixture: ComponentFixture<TrendsComponent>;
  const rows: TrendSignalRow[] = [
    {
      keywordId: 10,
      keyword: '巧克力',
      heatToday: 72,
      slope7d: 0.1,
      slope30d: 0.05,
      divergenceFlag: false,
      enabled: true,
    },
    {
      keywordId: 11,
      keyword: '停用關鍵字',
      heatToday: 35,
      slope7d: -0.1,
      slope30d: -0.05,
      divergenceFlag: true,
      enabled: false,
    },
  ];
  const canManageImports = signal(true);
  const getTrends = vi.fn();
  const getTrendKeywordUsage = vi.fn();
  const updateTrendKeywordEnabled = vi.fn();
  const confirm = vi.fn();
  const navigate = vi.fn();

  beforeEach(async () => {
    canManageImports.set(true);
    getTrends.mockReset().mockReturnValue(of(rows));
    getTrendKeywordUsage.mockReset().mockReturnValue(of({
      success: true,
      data: {
        keywordId: 10,
        keyword: '巧克力',
        enabled: true,
        products: [{ id: 21, name: '杜拜巧克力' }, { id: 22, name: '金沙巧克力' }],
      },
    }));
    updateTrendKeywordEnabled.mockReset().mockReturnValue(of({
      success: true,
      data: { id: 10, keyword: '巧克力', enabled: false },
    }));
    confirm.mockReset().mockReturnValue(of(true));
    navigate.mockReset();

    await TestBed.configureTestingModule({
      imports: [TrendsComponent],
      providers: [
        { provide: TrendControllerService, useValue: { getTrends } },
        {
          provide: ProductReferenceControllerService,
          useValue: { getTrendKeywordUsage, updateTrendKeywordEnabled },
        },
        { provide: AuthService, useValue: { canManageImports } },
        { provide: DialogService, useValue: { Confirm: confirm } },
        { provide: Router, useValue: { navigate } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TrendsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('adds the enabled column to the right of AI signal', () => {
    expect(component.displayedColumns.at(-1)).toBe('keywordEnabled');
    const headers = Array.from(fixture.nativeElement.querySelectorAll('th')) as HTMLElement[];
    expect(headers.at(-1)?.textContent?.trim()).toBe('關鍵字啟用');
  });

  it('shows total and enabled keyword counts independent of filters', () => {
    const summary = fixture.nativeElement.querySelector('.sub') as HTMLElement;
    expect(summary.textContent).toContain('已建立關鍵字：2 個');
    expect(summary.textContent).toContain('啟動中：1 個');

    component.onEnabledFilterChange('DISABLED');
    fixture.detectChanges();

    expect(component.filteredTrends().map((item) => item.keywordId)).toEqual([11]);
    expect(summary.textContent).toContain('已建立關鍵字：2 個');
    expect(summary.textContent).toContain('啟動中：1 個');
  });

  it('filters enabled and disabled keywords and resets all conditions', () => {
    component.onEnabledFilterChange('ENABLED');
    expect(component.filteredTrends().map((item) => item.keywordId)).toEqual([10]);

    component.onEnabledFilterChange('DISABLED');
    expect(component.filteredTrends().map((item) => item.keywordId)).toEqual([11]);

    component.resetFilters();
    expect(component.enabledFilter()).toBe('ALL');
    expect(component.filteredTrends()).toHaveLength(2);
  });

  it('asks for confirmation with affected products before disabling a bound keyword', () => {
    component.onKeywordToggle({ stopPropagation: vi.fn() } as unknown as MouseEvent, rows[0]);

    expect(getTrendKeywordUsage).toHaveBeenCalledWith({ id: 10 });
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('杜拜巧克力'),
      isDanger: true,
    }));
    expect(confirm.mock.calls[0][0].message).toContain('金沙巧克力');
    expect(updateTrendKeywordEnabled).toHaveBeenCalledWith({
      id: 10,
      trendKeywordEnabledUpdateRequest: { enabled: false },
    });
    expect(component.trendList()[0].enabled).toBe(false);
  });

  it('does not update when the operator cancels the disable confirmation', () => {
    confirm.mockReturnValue(of(false));

    component.onKeywordToggle({ stopPropagation: vi.fn() } as unknown as MouseEvent, rows[0]);

    expect(updateTrendKeywordEnabled).not.toHaveBeenCalled();
    expect(component.trendList()[0].enabled).toBe(true);
  });

  it('prevents users outside DATA_ADMIN and SYS_ADMIN from interacting', () => {
    canManageImports.set(false);
    fixture.detectChanges();

    const toggle = fixture.nativeElement.querySelector('.keyword-toggle') as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
    component.onKeywordToggle({ stopPropagation: vi.fn() } as unknown as MouseEvent, rows[0]);
    expect(getTrendKeywordUsage).not.toHaveBeenCalled();
    expect(updateTrendKeywordEnabled).not.toHaveBeenCalled();
  });
});
