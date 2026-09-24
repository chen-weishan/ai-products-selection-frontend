import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { LoginRequest, LoginResponse, UserInfo, UserRole } from '../models/auth-model';
import { Observable, delay, of, tap, throwError } from 'rxjs';
import { MOCK_ACCOUNTS, MockAccount, createMockLoginResponse, findMockAccount } from './mock-users';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly ACCESS_TOKEN_KEY = 'ssds_access_Token';
  private readonly REFRESH_TOKEN_KEY = 'ssds_refresh_Token';
  private readonly USER_KEY = 'ssds_user_info';

  /** 是否使用前端假資料模式（若後端尚未連接則為 true） */
  private useMock = false;

  /** 當前所有可用之模擬帳號清單 */
  readonly mockAccounts: MockAccount[] = MOCK_ACCOUNTS;

  readonly currentUser = signal<UserInfo | null>(this.getStoredUser());

  readonly isLoggedIn = computed(() => !!this.currentUser() && !!this.getAccessToken());

  /** 是否為唯讀觀察者 (VIEWER) */
  readonly isViewer = computed(() => this.hasRole('VIEWER'));

  /** 是否具備權重發布與編輯權限 (BUYER_LEAD 或 SYS_ADMIN) */
  readonly canManageWeights = computed(() => this.hasRole(['BUYER_LEAD', 'SYS_ADMIN']));

  /** 是否具備決策終審覆核權限 (BUYER_LEAD 或 SYS_ADMIN) */
  readonly canApproveDecision = computed(() => this.hasRole(['BUYER_LEAD', 'SYS_ADMIN']));

  /** 是否具備資料匯入/維護權限 (DATA_ADMIN 或 SYS_ADMIN) */
  readonly canManageImports = computed(() => this.hasRole(['DATA_ADMIN', 'SYS_ADMIN']));

  /** 取得所有模擬測試帳號 */
  getMockAccounts(): MockAccount[] {
    return this.mockAccounts;
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    if (this.useMock) {
      const account = findMockAccount(credentials.email, credentials.password);
      if (!account) {
        return throwError(() => new Error('帳號或密碼錯誤，請重新輸入')).pipe(
          delay(400)
        );
      }

      const mockResponse = createMockLoginResponse(account);
      return of(mockResponse as any).pipe(
        delay(400),
        tap(res => {
          this.saveAuthData(res);
        })
      );
    }

    const loginUrl = environment?.apiBaseUrl ? `${environment.apiBaseUrl}/auth/login` : '/api/v1/auth/login';
    return this.http.post<unknown>(loginUrl, credentials).pipe(
      tap(res => console.log('[AuthService] /auth/login response:', res)),
      map(res => {
        const anyRes = res as any;
        const tokens = anyRes?.data?.tokens || anyRes?.tokens;
        const accessToken =
          tokens?.accessToken ||
          tokens?.access_token ||
          anyRes?.data?.accessToken ||
          anyRes?.data?.access_token ||
          anyRes?.accessToken ||
          anyRes?.access_token;

        const refreshToken =
          tokens?.refreshToken ||
          tokens?.refresh_token ||
          anyRes?.data?.refreshToken ||
          anyRes?.data?.refresh_token ||
          anyRes?.refreshToken ||
          anyRes?.refresh_token;

        const backendUser = anyRes?.data?.user || anyRes?.user;
        const rawRoles = backendUser?.roles || anyRes?.data?.roles || anyRes?.roles || (anyRes?.role ? [anyRes.role] : []);
        const roles: UserRole[] = Array.isArray(rawRoles) ? rawRoles : [rawRoles];
        const primaryRole: UserRole = roles[0] || 'BUYER';

        if (!accessToken) {
          console.error('[AuthService] 無法在後端回應中解析出 accessToken:', res);
          throw new Error(anyRes?.error?.message || anyRes?.message || '登入失敗，未取得驗證 token');
        }

        const email = backendUser?.email ?? anyRes?.email ?? anyRes?.username ?? credentials.email;
        const displayName = backendUser?.displayName ?? backendUser?.name ?? anyRes?.displayName ?? anyRes?.name ?? email;

        const loginResponse: LoginResponse = {
          accessToken: accessToken,
          refreshToken: refreshToken,
          email: email,
          displayName: displayName,
          roles: roles,
          user: {
            id: backendUser?.id ?? anyRes?.id ?? 0,
            username: email,
            name: displayName,
            email: email,
            displayName: displayName,
            role: primaryRole,
            roles: roles,
          }
        };
        this.saveAuthData(loginResponse);
        return loginResponse;
      })
    );
  }

  /** 快速以指定角色模擬登入 */
  loginAsMock(roleOrEmail: UserRole | string): Observable<LoginResponse> {
    const account = this.mockAccounts.find(
      a => a.role === roleOrEmail || a.email.toLowerCase() === roleOrEmail.toLowerCase()
    ) || this.mockAccounts[0];

    const mockResponse = createMockLoginResponse(account);
    return of(mockResponse as any).pipe(
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
    localStorage.removeItem('ssds_access_token');
    localStorage.removeItem('ssds_user_info');
    this.currentUser.set(null);
    void this.router.navigate(['/login']);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY) || localStorage.getItem('ssds_access_token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  gatRefreshToken(): string | null {
    return this.getRefreshToken();
  }

  hasRole(roles: UserRole | readonly UserRole[]): boolean {
    const user = this.currentUser();
    if (!user) return false;

    const acceptedRoles = Array.isArray(roles) ? roles : [roles];
    const userRoles = user.roles && user.roles.length > 0 ? user.roles : (user.role ? [user.role] : []);
    return userRoles.some(role => (acceptedRoles as any).includes(role));
  }

  private saveAuthData(response: any): void {
    const token = response.accessToken || response.data?.accessToken;
    const email = response.email || response.user?.email || response.user?.username || '';
    const displayName = response.displayName || response.user?.displayName || response.user?.name || email;
    const rawRoles = response.roles || response.user?.roles || (response.user?.role ? [response.user.role] : ['BUYER']);
    const roles: UserRole[] = Array.isArray(rawRoles) ? rawRoles : [rawRoles];
    const primaryRole: UserRole = roles[0] || 'BUYER';

    const user: UserInfo = {
      id: response.id || response.user?.id || 0,
      username: email,
      name: displayName,
      email: email,
      displayName: displayName,
      role: primaryRole,
      roles: roles,
    };

    localStorage.setItem(this.ACCESS_TOKEN_KEY, token);
    localStorage.setItem('ssds_access_token', token);

    if (response.refreshToken) {
      localStorage.setItem(this.REFRESH_TOKEN_KEY, response.refreshToken);
    }

    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    localStorage.setItem('ssds_user_info', JSON.stringify(user));
    this.currentUser.set(user);
  }

  private getStoredUser(): UserInfo | null {
    const data = localStorage.getItem(this.USER_KEY) || localStorage.getItem('ssds_user_info');
    if (!data) return null;
    try {
      const parsed = JSON.parse(data);
      if (!parsed) return null;
      const roles: UserRole[] = Array.isArray(parsed.roles) ? parsed.roles : (parsed.role ? [parsed.role] : ['BUYER']);
      return {
        id: parsed.id ?? 0,
        username: parsed.username ?? parsed.email ?? '',
        name: parsed.name ?? parsed.displayName ?? '使用者',
        email: parsed.email ?? parsed.username ?? '',
        displayName: parsed.displayName ?? parsed.name ?? '使用者',
        role: parsed.role ?? roles[0] ?? 'BUYER',
        roles: roles,
      };
    } catch {
      return null;
    }
  }
}
