import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';

import { ReportsComponent } from './reports.component';
import { ReportEventsService, ReportStreamEvent } from './report-events.service';
import { ReportService } from './report.service';

describe('ReportsComponent', () => {
  let component: ReportsComponent;
  let fixture: ComponentFixture<ReportsComponent>;
  let events$: Subject<ReportStreamEvent>;
  const reportService = {
    list: vi.fn(() => of({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 })),
    filterOptions: vi.fn(() => of({
      categories: [{ id: 2, label: '食品／餅乾' }],
      decisionMakers: [{ id: 7, displayName: '王小明', email: 'buyer@example.com' }],
      scorePeriods: ['2026W41', '2026W39', '2025W52'],
      calibrationQuarters: ['2026Q3', '2026Q2'],
    })),
    generate: vi.fn(),
    download: vi.fn(),
  };
  const reportEvents = {
    watch: vi.fn(),
  };

  beforeEach(async () => {
    events$ = new Subject<ReportStreamEvent>();
    reportEvents.watch.mockReturnValue(events$);
    reportService.list.mockClear();
    reportService.filterOptions.mockClear();
    reportService.generate.mockClear();
    await TestBed.configureTestingModule({
      imports: [ReportsComponent],
      providers: [
        { provide: ReportService, useValue: reportService },
        { provide: ReportEventsService, useValue: reportEvents },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.definitions).toHaveLength(5);
    expect(reportService.list).toHaveBeenCalledTimes(1);
    expect(reportService.filterOptions).toHaveBeenCalledTimes(1);
    expect(reportEvents.watch).toHaveBeenCalledTimes(1);
  });

  it('allows an explicit status refresh', () => {
    expect(reportService.list).toHaveBeenCalledTimes(1);

    component.refresh();

    expect(reportService.list).toHaveBeenCalledTimes(2);
  });

  it('reconciles the report list after the SSE connection opens', () => {
    events$.next({ type: 'connected' });

    expect(reportService.list).toHaveBeenCalledTimes(2);
  });

  it('replaces a processing row with the downloadable report pushed by SSE', () => {
    component.jobs.set([{
      id: 7,
      reportType: 'WEEKLY_PICK',
      format: 'PDF',
      params: { period: '2026W41' },
      status: 'RUNNING',
      requestedAt: '2026-10-06T00:00:00Z',
      downloadable: false,
    }]);
    events$.next({ type: 'status', job: component.jobs()[0] });

    events$.next({
      type: 'status',
      job: {
        id: 7,
        reportType: 'WEEKLY_PICK',
        format: 'PDF',
        params: { period: '2026W41' },
        status: 'SUCCEEDED',
        fileName: 'weekly.pdf',
        fileSize: 1200,
        rowCount: 40,
        requestedAt: '2026-10-06T00:00:00Z',
        finishedAt: '2026-10-06T00:00:05Z',
        downloadable: true,
      },
    });

    expect(component.jobs()[0]).toEqual(expect.objectContaining({
      id: 7,
      status: 'SUCCEEDED',
      downloadable: true,
    }));
    expect(component.successMessage()).toContain('已完成，可下載');
  });

  it('stops listening when leaving the report page', () => {
    expect(events$.observed).toBe(true);

    fixture.destroy();

    expect(events$.observed).toBe(false);
  });

  it('dismisses a success notification automatically after five seconds', () => {
    vi.useFakeTimers();
    reportService.generate.mockReturnValue(of({
      id: 9,
      reportType: 'WEEKLY_PICK',
      format: 'PDF',
      params: {},
      status: 'SUCCEEDED',
      requestedAt: '2026-10-06T00:00:00Z',
      downloadable: true,
    }));

    component.generate(component.definitions[0]);
    expect(component.successMessage()).toContain('可立即下載');

    vi.advanceTimersByTime(5_000);
    expect(component.successMessage()).toBe('');
    vi.useRealTimers();
  });

  it('allows the user to close a success notification immediately', () => {
    reportService.generate.mockReturnValue(of({
      id: 10,
      reportType: 'WEEKLY_PICK',
      format: 'PDF',
      params: {},
      status: 'SUCCEEDED',
      requestedAt: '2026-10-06T00:00:00Z',
      downloadable: true,
    }));
    component.generate(component.definitions[0]);
    fixture.detectChanges();

    const closeButton: HTMLButtonElement | null = fixture.nativeElement.querySelector('.message-close');
    expect(closeButton).not.toBeNull();
    closeButton?.click();

    expect(component.successMessage()).toBe('');
  });

  it('combines the selected year and week into the backend period format', () => {
    reportService.generate.mockReturnValue(of({
      id: 8,
      reportType: 'WEEKLY_PICK',
      format: 'PDF',
      params: {},
      status: 'PENDING',
      requestedAt: '2026-10-06T00:00:00Z',
      downloadable: false,
    }));
    component.periodYear.setValue(2026);
    component.periodWeek.setValue(39);

    component.generate(component.definitions[0]);

    expect(reportService.generate).toHaveBeenCalledWith(expect.objectContaining({
      params: expect.objectContaining({ period: '2026W39' }),
    }));
    expect(component.periodLabel()).toBe('2026 年第 39 週');
  });

  it('only offers weeks that have score data for the selected year', () => {
    expect(component.periodYears()).toEqual([2026, 2025]);
    expect(component.periodWeeks()).toEqual([41, 39]);
    expect(component.periodLabel()).toBe('2026 年第 41 週');

    component.periodYear.setValue(2025);
    component.onPeriodYearChange(2025);

    expect(component.periodWeeks()).toEqual([52]);
    expect(component.periodWeek.value).toBe(52);
  });

  it('converts the Material datepicker values to backend local-date strings', () => {
    reportService.generate.mockReturnValue(of({
      id: 11,
      reportType: 'ACCURACY',
      format: 'PDF',
      params: {},
      status: 'PENDING',
      requestedAt: '2026-10-06T00:00:00Z',
      downloadable: false,
    }));
    component.accuracyFrom.setValue(new Date(2025, 9, 6));
    component.accuracyTo.setValue(new Date(2026, 9, 6));

    component.generate(component.definitions[2]);

    expect(reportService.generate).toHaveBeenCalledWith(expect.objectContaining({
      params: expect.objectContaining({ from: '2025-10-06', to: '2026-10-06' }),
    }));
  });
});
