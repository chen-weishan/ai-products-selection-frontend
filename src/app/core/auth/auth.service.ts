import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { LoginRequest, LoginResponse, UserInfo, UserRole } from '../models/auth-model';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly accessTokenKey = 'ssds_access_token';
  private readonly userKey = 'ssds_user_info';

  readonly currentUser = signal<UserInfo | null>(this.getStoredUser());
  readonly isLoggedIn = computed(
    () => this.currentUser() !== null && this.getAccessToken() !== null,
  );

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiBaseUrl}/auth/login`, credentials)
      .pipe(tap((response) => this.saveAuthData(response)));
  }

  logout(): void {
    localStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.userKey);
    this.currentUser.set(null);
    void this.router.navigate(['/login']);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.accessTokenKey);
  }

  hasRole(roles: UserRole | readonly UserRole[]): boolean {
    const user = this.currentUser();
    if (!user) return false;

    const acceptedRoles = Array.isArray(roles) ? roles : [roles];
    return user.roles.some((role) => acceptedRoles.includes(role));
  }

  private saveAuthData(response: LoginResponse): void {
    const user: UserInfo = {
      email: response.email,
      displayName: response.displayName,
      roles: response.roles,
    };
    localStorage.setItem(this.accessTokenKey, response.accessToken);
    localStorage.setItem(this.userKey, JSON.stringify(user));
    this.currentUser.set(user);
  }

  private getStoredUser(): UserInfo | null {
    const data = localStorage.getItem(this.userKey);
    if (!data) return null;

    try {
      const user = JSON.parse(data) as Partial<UserInfo>;
      return typeof user.email === 'string' &&
        typeof user.displayName === 'string' &&
        Array.isArray(user.roles)
        ? (user as UserInfo)
        : null;
    } catch {
      return null;
    }
  }
}
