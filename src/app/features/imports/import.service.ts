import { HttpClient, HttpContext, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_GLOBAL_LOADING } from '../../core/http/loading-interceptor';
import {
  ImportBatchResponse,
  ImportDataType,
  ImportField,
  ImportMappingTemplate,
  ImportMappingTemplateRequest,
  ImportPage,
  ImportPreviewResponse,
  ImportUploadResponse,
} from './import.models';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { message?: string };
}

@Injectable({ providedIn: 'root' })
export class ImportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/imports`;

  fields(dataType: ImportDataType): Observable<ImportField[]> {
    return this.get<ImportField[]>(`${this.baseUrl}/fields`, { dataType });
  }

  upload(dataType: ImportDataType, file: File): Observable<ImportUploadResponse> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http
      .post<ApiResponse<ImportUploadResponse>>(`${this.baseUrl}/upload`, formData, {
        params: { dataType },
      })
      .pipe(this.unwrap('上傳匯入檔案失敗'));
  }

  resumePending(batchId: number): Observable<ImportUploadResponse> {
    return this.get<ImportUploadResponse>(`${this.baseUrl}/${batchId}/resume`);
  }

  preview(
    batchId: number,
    mappings: Record<string, string>,
  ): Observable<ImportPreviewResponse> {
    return this.http
      .post<ApiResponse<ImportPreviewResponse>>(`${this.baseUrl}/${batchId}/preview`, { mappings })
      .pipe(this.unwrap('預覽匯入資料失敗'));
  }

  confirm(
    batchId: number,
    mappings: Record<string, string>,
  ): Observable<ImportBatchResponse> {
    return this.http
      .post<ApiResponse<ImportBatchResponse>>(`${this.baseUrl}/${batchId}/confirm`, { mappings })
      .pipe(this.unwrap('確認匯入失敗'));
  }

  batches(page = 0, size = 20): Observable<ImportPage<ImportBatchResponse>> {
    return this.get<ImportPage<ImportBatchResponse>>(this.baseUrl, {
      page: String(page),
      size: String(size),
      sort: 'createdAt,desc',
    });
  }

  batch(batchId: number): Observable<ImportBatchResponse> {
    return this.http
      .get<ApiResponse<ImportBatchResponse>>(`${this.baseUrl}/${batchId}`, {
        context: new HttpContext().set(SKIP_GLOBAL_LOADING, true),
      })
      .pipe(this.unwrap('取得匯入進度失敗'));
  }

  downloadPreviewErrors(
    batchId: number,
    mappings: Record<string, string>,
  ): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/${batchId}/preview/errors/download`, { mappings }, {
      responseType: 'blob',
    });
  }

  downloadErrors(batchId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${batchId}/errors/download`, { responseType: 'blob' });
  }

  downloadUnprocessed(batchId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${batchId}/unprocessed/download`, { responseType: 'blob' });
  }

  retryRecalculation(batchId: number): Observable<number> {
    return this.http.post<ApiResponse<number>>(`${this.baseUrl}/${batchId}/recalculation/retry`, {})
      .pipe(this.unwrap('重新排入評分更新失敗'));
  }

  templates(dataType: ImportDataType): Observable<ImportMappingTemplate[]> {
    return this.get<ImportMappingTemplate[]>(`${this.baseUrl}/mapping-templates`, { dataType });
  }

  createTemplate(request: ImportMappingTemplateRequest): Observable<ImportMappingTemplate> {
    return this.http
      .post<ApiResponse<ImportMappingTemplate>>(`${this.baseUrl}/mapping-templates`, request)
      .pipe(this.unwrap('建立欄位對應範本失敗'));
  }

  updateTemplate(
    id: number,
    request: ImportMappingTemplateRequest,
  ): Observable<ImportMappingTemplate> {
    return this.http
      .put<ApiResponse<ImportMappingTemplate>>(`${this.baseUrl}/mapping-templates/${id}`, request)
      .pipe(this.unwrap('更新欄位對應範本失敗'));
  }

  deleteTemplate(id: number): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.baseUrl}/mapping-templates/${id}`)
      .pipe(
        map((response) => {
          if (!response.success) {
            throw new Error(response.error?.message ?? '刪除欄位對應範本失敗');
          }
          return undefined;
        }),
        catchError((error) => this.rethrow(error)),
      );
  }

  private get<T>(url: string, parameters?: Record<string, string>): Observable<T> {
    const params = new HttpParams({ fromObject: parameters ?? {} });
    return this.http
      .get<ApiResponse<T>>(url, { params })
      .pipe(this.unwrap('取得匯入資料失敗'));
  }

  private unwrap<T>(fallbackMessage: string) {
    return (source: Observable<ApiResponse<T>>): Observable<T> =>
      source.pipe(
        map((response) => {
          if (!response.success || response.data == null) {
            throw new Error(response.error?.message ?? fallbackMessage);
          }
          return response.data;
        }),
        catchError((error) => this.rethrow(error)),
      );
  }

  private rethrow(error: unknown): Observable<never> {
    if (error instanceof HttpErrorResponse) {
      const details = error.error?.error?.fieldErrors;
      const detailText = Array.isArray(details) ? details.map((item: { message?: string }) => item.message).filter(Boolean).join('；') : '';
      const message = detailText || error.error?.error?.message;
      return throwError(() => new Error(typeof message === 'string' ? message : error.message));
    }
    return throwError(() => error);
  }
}
