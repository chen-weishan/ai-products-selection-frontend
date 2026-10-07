import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import {
  ApiError,
  PageResponseReportJobResponse,
  ReportFilterOptionsResponse,
  ReportJobResponse,
  ReportsService,
} from '../../api';
import {
  ReportFilterOptions,
  ReportGenerateRequest,
  ReportJob,
  ReportPage,
} from './report.models';

interface GeneratedApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: ApiError;
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly api = inject(ReportsService);

  generate(request: ReportGenerateRequest): Observable<ReportJob> {
    return this.api
      .generateReport({ reportGenerateRequest: request })
      .pipe(
        this.unwrap('建立報表任務失敗'),
        map(job => this.normalizeJob(job)),
      );
  }

  list(page = 0, size = 20): Observable<ReportPage> {
    return this.api
      .listReports({ page, size, sort: ['requestedAt,desc'] })
      .pipe(
        this.unwrap('取得報表紀錄失敗'),
        map(result => this.normalizePage(result)),
      );
  }

  download(id: number): Observable<HttpResponse<Blob>> {
    return this.api.downloadReport({ id }, 'response');
  }

  filterOptions(): Observable<ReportFilterOptions> {
    return this.api
      .getReportFilterOptions()
      .pipe(
        this.unwrap('取得報表條件選項失敗'),
        map(options => this.normalizeFilterOptions(options)),
      );
  }

  private unwrap<T>(fallback: string) {
    return (source: Observable<GeneratedApiResponse<T>>): Observable<T> =>
      source.pipe(
        map((response) => {
          if (!response.success || response.data == null) {
            throw new Error(response.error?.message ?? fallback);
          }
          return response.data;
        }),
        catchError((error) => this.rethrow(error, fallback)),
      );
  }

  private normalizePage(page: PageResponseReportJobResponse): ReportPage {
    return {
      content: (page.content ?? []).map(job => this.normalizeJob(job)),
      page: page.page ?? 0,
      size: page.size ?? 0,
      totalElements: page.totalElements ?? 0,
      totalPages: page.totalPages ?? 0,
    };
  }

  private normalizeJob(job: ReportJobResponse): ReportJob {
    if (
      job.id == null ||
      job.reportType == null ||
      job.format == null ||
      job.status == null ||
      job.requestedAt == null
    ) {
      throw new Error('後端回傳的報表資料不完整');
    }
    return {
      id: job.id,
      reportType: job.reportType,
      format: job.format,
      params: (job.params ?? {}) as Record<string, string | number>,
      status: job.status,
      fileName: job.fileName ?? null,
      fileSize: job.fileSize ?? null,
      rowCount: job.rowCount ?? null,
      requestedAt: job.requestedAt,
      finishedAt: job.finishedAt ?? null,
      downloadable: job.downloadable ?? false,
    };
  }

  private normalizeFilterOptions(options: ReportFilterOptionsResponse): ReportFilterOptions {
    return {
      categories: (options.categories ?? []).flatMap(option =>
        option.id != null && option.label
          ? [{ id: option.id, label: option.label }]
          : [],
      ),
      decisionMakers: (options.decisionMakers ?? []).flatMap(option =>
        option.id != null && option.displayName && option.email
          ? [{ id: option.id, displayName: option.displayName, email: option.email }]
          : [],
      ),
      scorePeriods: options.scorePeriods ?? [],
      calibrationQuarters: options.calibrationQuarters ?? [],
    };
  }

  private rethrow(error: unknown, fallback: string): Observable<never> {
    if (error instanceof HttpErrorResponse) {
      const details = error.error?.error?.fieldErrors;
      const detail = Array.isArray(details)
        ? details.map((item: { message?: string }) => item.message).filter(Boolean).join('；')
        : '';
      const message = detail || error.error?.error?.message || error.message || fallback;
      return throwError(() => new Error(message));
    }
    return throwError(() => error instanceof Error ? error : new Error(fallback));
  }
}
