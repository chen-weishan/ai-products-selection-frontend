import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CategoryNode {
  id: number;
  name: string;
  sortOrder: number;
  children: CategoryNode[];
}

export interface CategoryUpsertRequest {
  name: string;
  parentId: number | null;
  sortOrder: number;
}

export interface CategoryRecord {
  id: number;
  name: string;
  parentId: number | null;
  parentName: string | null;
  sortOrder: number;
}

export interface SupplierRecord {
  id: number;
  name: string;
  contact: string | null;
  phone: string | null;
  note: string | null;
}

export interface SupplierUpsertRequest {
  name: string;
  contact: string | null;
  phone: string | null;
  note: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { message?: string };
}

@Injectable({ providedIn: 'root' })
export class MasterDataService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  categories(): Observable<CategoryNode[]> {
    return this.http
      .get<ApiResponse<CategoryNode[]>>(`${this.baseUrl}/categories`)
      .pipe(this.unwrap('取得類別失敗'));
  }

  createCategory(request: CategoryUpsertRequest): Observable<CategoryRecord> {
    return this.http
      .post<ApiResponse<CategoryRecord>>(`${this.baseUrl}/categories`, request)
      .pipe(this.unwrap('新增類別失敗'));
  }

  updateCategory(id: number, request: CategoryUpsertRequest): Observable<CategoryRecord> {
    return this.http
      .put<ApiResponse<CategoryRecord>>(`${this.baseUrl}/categories/${id}`, request)
      .pipe(this.unwrap('修改類別失敗'));
  }

  deleteCategory(id: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.baseUrl}/categories/${id}`)
      .pipe(this.unwrapVoid('刪除類別失敗'));
  }

  suppliers(): Observable<SupplierRecord[]> {
    return this.http
      .get<ApiResponse<SupplierRecord[]>>(`${this.baseUrl}/suppliers`)
      .pipe(this.unwrap('取得供應商失敗'));
  }

  createSupplier(request: SupplierUpsertRequest): Observable<SupplierRecord> {
    return this.http
      .post<ApiResponse<SupplierRecord>>(`${this.baseUrl}/suppliers`, request)
      .pipe(this.unwrap('新增供應商失敗'));
  }

  updateSupplier(id: number, request: SupplierUpsertRequest): Observable<SupplierRecord> {
    return this.http
      .put<ApiResponse<SupplierRecord>>(`${this.baseUrl}/suppliers/${id}`, request)
      .pipe(this.unwrap('修改供應商失敗'));
  }

  deleteSupplier(id: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.baseUrl}/suppliers/${id}`)
      .pipe(this.unwrapVoid('刪除供應商失敗'));
  }

  private unwrap<T>(fallback: string) {
    return (source: Observable<ApiResponse<T>>): Observable<T> =>
      source.pipe(
        map((response) => {
          if (!response.success || response.data == null) {
            throw new Error(response.error?.message ?? fallback);
          }
          return response.data;
        }),
        catchError((error: unknown) => throwError(() => new Error(apiErrorMessage(error, fallback)))),
      );
  }

  private unwrapVoid(fallback: string) {
    return (source: Observable<ApiResponse<void>>): Observable<void> =>
      source.pipe(
        map((response) => {
          if (!response.success) throw new Error(response.error?.message ?? fallback);
        }),
        catchError((error: unknown) => throwError(() => new Error(apiErrorMessage(error, fallback)))),
      );
  }
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const message = error.error?.error?.message;
    return typeof message === 'string' ? message : fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
