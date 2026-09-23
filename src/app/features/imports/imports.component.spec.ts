import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ImportsComponent } from './imports.component';
import { ImportBatchResponse } from './import.models';
import { ImportService } from './import.service';

describe('ImportsComponent', () => {
  let component: ImportsComponent;
  let fixture: ComponentFixture<ImportsComponent>;
  let batchRequest: ReturnType<typeof vi.fn>;
  let resumeRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    batchRequest = vi.fn();
    resumeRequest = vi.fn();
    const importService = {
      fields: vi.fn().mockReturnValue(of([
        { key: 'sku', label: '品項編號', valueType: 'STRING', required: true },
      ])),
      templates: vi.fn().mockReturnValue(of([])),
      batches: vi.fn().mockReturnValue(of({
        content: [], page: 0, size: 20, totalElements: 0, totalPages: 0,
      })),
      batch: batchRequest,
      resumePending: resumeRequest,
    };

    await TestBed.configureTestingModule({
      imports: [ImportsComponent],
      providers: [{ provide: ImportService, useValue: importService }],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows correction, unprocessed data and scoring failure independently', () => {
    component.step.set(4);
    component.batchResult.set({
      batchId: 20, dataType: 'SALES', fileName: 'sales.csv', totalRows: 10,
      successRows: 5, failRows: 1, skippedRows: 2, unprocessedRows: 2, processedRows: 8,
      progressPercent: 80, status: 'FAILED', async: false, createdAt: '2026-09-23',
      failureReason: '匯入執行逾時', hasCorrectableErrors: true, canDownloadUnprocessed: true,
      recalculation: { SCORED: 3, FAILED: 1 },
    });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('下載待修正資料');
    expect(text).toContain('下載未處理資料');
    expect(text).toContain('重試評分更新');
    expect(text).toContain('匯入執行逾時');
    expect(text).not.toContain('undefined');
  });

  it('shows audience composition before confirmation', () => {
    component.step.set(3);
    component.previewResult.set({ batchId: 1, dataType: 'AUDIENCE', totalRows: 2, validRows: 2,
      errorRows: 0, duplicateRows: 0, async: false, previewRows: [],
      audienceChanges: [{ category: '飲料', before: { MAIN: 1 }, after: { MAIN: 0.6, VALUE: 0.4 } }],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('MAIN 100.0%');
    expect(fixture.nativeElement.textContent).toContain('MAIN 60.0%、VALUE 40.0%');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.fields()).toHaveLength(1);
    expect(component.history()).toEqual([]);
  });

  it('does not poll a batch that has not been confirmed', () => {
    const pending: ImportBatchResponse = {
      batchId: 6, dataType: 'REVIEW', fileName: 'reviews_valid.csv',
      totalRows: 5, successRows: 0, failRows: 0, processedRows: 0,
      progressPercent: 0, status: 'PENDING', async: false,
      createdAt: '2026-09-16T07:13:09Z',
    };

    component.viewBatch(pending);
    fixture.detectChanges();

    expect(component.polling()).toBe(false);
    expect(batchRequest).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('尚未確認匯入');
  });

  it('resumes a pending batch from history after page state is lost', () => {
    const pending: ImportBatchResponse = {
      batchId: 12, dataType: 'REVIEW', fileName: 'reviews.csv',
      totalRows: 2, successRows: 0, failRows: 0, processedRows: 0,
      progressPercent: 0, status: 'PENDING', async: false,
      createdAt: '2026-09-16T07:13:09Z',
    };
    resumeRequest.mockReturnValue(of({
      batchId: 12, dataType: 'REVIEW', fileName: 'reviews.csv',
      fileSize: 100, totalRows: 2, async: false,
      headers: ['品名', '評論內容'],
      savedMappings: { 品名: 'productName', 評論內容: 'content' },
      mappingSuggestions: [{ sourceHeader: '品名', systemField: 'productName',
        status: 'AUTO_MAPPED', confidence: 1 }],
    }));

    component.viewBatch(pending);
    component.resumePending(pending);
    fixture.detectChanges();

    expect(resumeRequest).toHaveBeenCalledWith(12);
    expect(component.step()).toBe(2);
    expect(component.uploadResult()?.batchId).toBe(12);
    expect(component.mappings()).toEqual({ 品名: 'productName', 評論內容: 'content' });
  });

  it('shows a batch failure without offering a non-reimportable summary CSV', () => {
    const failed: ImportBatchResponse = {
      batchId: 13, dataType: 'SALES', fileName: 'sales.csv',
      totalRows: 3, successRows: 0, failRows: 3, processedRows: 3,
      progressPercent: 100, status: 'FAILED', async: true,
      createdAt: '2026-09-16T07:13:09Z',
    };
    batchRequest.mockReturnValue(of({ ...failed, failureReason: '匯入執行逾時，請分批上傳',
      hasCorrectableErrors: false }));

    component.viewBatch(failed);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('匯入執行逾時');
    expect(fixture.nativeElement.textContent).not.toContain('下載待修正資料');
  });
});
