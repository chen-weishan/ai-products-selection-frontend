import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { LoginRequest, LoginResponse, UserInfo, UserRole } from '../models/auth-model';
import { Observable, delay, of, tap, throwError } from 'rxjs';
import { MOCK_ACCOUNTS, MockAccount, createMockLoginResponse, findMockAccount } from './mock-users';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private readonly ACCESS_TOKEN_KEY = 'ssds_access_Token';
  private readonly REFRESH_TOKEN_KEY = 'ssds_refresh_Token';
  private readonly USER_KEY = 'ssds_user_info';

  /** 是否使用前端假資料模式（若後端尚未連接則為 true） */
  private useMock = true;

  /** 當前所有可用之模擬帳號清單 */
  readonly mockAccounts: MockAccount[] = MOCK_ACCOUNTS;

  readonly currentUser = signal<UserInfo | null>(this.getStoredUser());

  readonly isLoggedIn = computed(() => !!this.currentUser() && !!this.getAccessToken());

  /** 取得所有模擬測試帳號 */
  getMockAccounts(): MockAccount[] {
    return this.mockAccounts;
  }

  /**
   * 登入驗證
   * 假資料模式下會比對 mock-users 帳密，並給予 400ms 網路延遲模擬
   */
  login(credentials: LoginRequest): Observable<LoginResponse> {
    if (this.useMock) {
      const account = findMockAccount(credentials.email, credentials.password);
      if (!account) {
        return throwError(() => new Error('帳號或密碼錯誤，請重新輸入')).pipe(
          delay(400)
        );
      }

      const mockResponse = createMockLoginResponse(account);
      return of(mockResponse).pipe(
        delay(400),
        tap(res => {
          this.saveAuthData(res);
        })
      );
    }

    return this.http.post<LoginResponse>('/api/v1/auth/login', credentials).pipe(
      tap(res => {
        this.saveAuthData(res);
      })
    );
  }

  /** 快速以指定角色模擬登入 */
  loginAsMock(roleOrEmail: UserRole | string): Observable<LoginResponse> {
    const account = this.mockAccounts.find(
      a => a.role === roleOrEmail || a.email.toLowerCase() === roleOrEmail.toLowerCase()
    ) || this.mockAccounts[0];

    const mockResponse = createMockLoginResponse(account);
    return of(mockResponse).pipe(
      delay(200),
      tap(res => {
        this.saveAuthData(res);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  /** 保留舊名稱以防相容性問題 */
  gatRefreshToken(): string | null {
    return this.getRefreshToken();
  }

  hasRole(roles: UserRole | UserRole[]): boolean {
    const user = this.currentUser();
    if (!user) return false;

    if (Array.isArray(roles)) {
      return roles.includes(user.role);
    }
    return user.role === roles;
  }

  private saveAuthData(response: LoginResponse) {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, response.accessToken);

    if (response.refreshToken) {
      localStorage.setItem(this.REFRESH_TOKEN_KEY, response.refreshToken);
    }

    localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));
    this.currentUser.set(response.user);
  }

  private getStoredUser(): UserInfo | null {
    const data = localStorage.getItem(this.USER_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data) as UserInfo;
    } catch {
      return null;
    }
  }
}
