import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { SKIP_GLOBAL_LOADING } from '../../core/http/loading-interceptor';
import { environment } from '../../../environments/environment';

export type RoleCode = 'BUYER' | 'BUYER_LEAD' | 'DATA_ADMIN' | 'SYS_ADMIN' | 'VIEWER';
export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface AdminUser {
  id: number;
  email: string;
  displayName: string;
  status: UserStatus;
  roles: RoleCode[];
  locked: boolean;
  lockedUntil: string | null;
  failedAttempts: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RoleOption {
  code: RoleCode;
  name: string;
  description: string | null;
}

export interface CreateUserRequest {
  email: string;
  displayName: string;
  password: string;
  roles: RoleCode[];
}

export interface UpdateUserRequest {
  displayName: string;
  roles: RoleCode[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { message?: string };
}

/** S-14 使用者管理分頁（§8.2 /admin/users，僅 SYS_ADMIN）。 */
@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/admin/users`;
  private readonly localLoading = { context: new HttpContext().set(SKIP_GLOBAL_LOADING, true) };

  list(): Observable<AdminUser[]> {
    return this.http.get<ApiResponse<AdminUser[]>>(this.baseUrl, this.localLoading).pipe(unwrap('取得使用者清單失敗'));
  }

  roles(): Observable<RoleOption[]> {
    return this.http.get<ApiResponse<RoleOption[]>>(`${this.baseUrl}/roles`, this.localLoading).pipe(unwrap('取得角色清單失敗'));
  }

  create(request: CreateUserRequest): Observable<AdminUser> {
    return this.http.post<ApiResponse<AdminUser>>(this.baseUrl, request, this.localLoading).pipe(unwrap('新增使用者失敗'));
  }

  update(id: number, request: UpdateUserRequest): Observable<AdminUser> {
    return this.http.put<ApiResponse<AdminUser>>(`${this.baseUrl}/${id}`, request, this.localLoading).pipe(unwrap('更新使用者失敗'));
  }

  changeStatus(id: number, status: UserStatus): Observable<AdminUser> {
    return this.http.patch<ApiResponse<AdminUser>>(`${this.baseUrl}/${id}/status`, { status }, this.localLoading)
      .pipe(unwrap(status === 'DISABLED' ? '停用帳號失敗' : '啟用帳號失敗'));
  }

  resetPassword(id: number, password: string): Observable<AdminUser> {
    return this.http.patch<ApiResponse<AdminUser>>(`${this.baseUrl}/${id}/password`, { password }, this.localLoading)
      .pipe(unwrap('重設密碼失敗'));
  }

  unlock(id: number): Observable<AdminUser> {
    return this.http.patch<ApiResponse<AdminUser>>(`${this.baseUrl}/${id}/unlock`, {}, this.localLoading)
      .pipe(unwrap('解除鎖定失敗'));
  }
}

function unwrap<T>(fallback: string) {
  return (source: Observable<ApiResponse<T>>): Observable<T> => source.pipe(
    map((response) => {
      if (!response.success || response.data == null) throw new Error(response.error?.message ?? fallback);
      return response.data;
    }),
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const message = error.error?.error?.message;
        return throwError(() => new Error(typeof message === 'string' ? message : fallback));
      }
      return throwError(() => (error instanceof Error ? error : new Error(fallback)));
    }),
  );
}

/** 產生易讀的隨機初始密碼（去掉 0/O、1/l/I 等易混淆字元）。 */
export function generatePassword(length = 12): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('');
}
