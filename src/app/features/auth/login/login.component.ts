import { Component, OnInit, inject } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';
import { MockAccount } from '../../../core/auth/mock-users';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-login',
  imports: [FormsModule, MatIcon],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  private authservice = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  private readonly REMEMBERED_EMAIL_KEY = 'ssds_remembered_email';

  email = '';
  password = '';
  showPassword = false;
  rememberMe = false;
  isLoading = false;
  errorMessage = '';
  fieldErrors: Record<string, string> = {};

  /** 模擬帳號列表供快速填入測試 */
  readonly mockAccounts = this.authservice.getMockAccounts();

  ngOnInit(): void {
    // 1. 若已經登入，直接導向首頁/儀表板
    // if (this.authservice.isLoggedIn()) {
    //   const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
    //   this.router.navigateByUrl(returnUrl);
    //   return;
    // }

    // 2. 還原「記住我」的電子郵件
    const savedEmail = localStorage.getItem(this.REMEMBERED_EMAIL_KEY);
    if (savedEmail) {
      this.email = savedEmail;
      this.rememberMe = true;
    }
  }

  /** 快速填入指定角色的測試帳密 */
  fillMockAccount(account: MockAccount): void {
    this.email = account.email;
    this.password = account.password;
    this.errorMessage = '';
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onLogin(): void {
    if (!this.email.trim() || !this.password.trim()) {
      this.errorMessage = '請輸入帳號或密碼';
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    this.fieldErrors = {};

    this.authservice.login({ email: this.email.trim(), password: this.password }).subscribe({
      next: () => {
        this.isLoading = false;

        // 處理記住我
        if (this.rememberMe) {
          localStorage.setItem(this.REMEMBERED_EMAIL_KEY, this.email.trim());
        } else {
          localStorage.removeItem(this.REMEMBERED_EMAIL_KEY);
        }

        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err: HttpErrorResponse | any) => {
        this.isLoading = false;
        this.handleLoginError(err);
        console.error('login failed', err);
      }
    });
  }

  private handleLoginError(err: HttpErrorResponse | any): void {
    // 1. 伺服器未啟動或無法連線 (status === 0)
    if (err instanceof HttpErrorResponse && err.status === 0) {
      this.errorMessage = '無法連線至後端伺服器，請確認伺服器是否已啟動 (8080 port)';
      return;
    }

    // 2. 嘗試解析後端自訂 API 錯誤結構 (err.error?.error)
    const backendError = err?.error?.error;
    if (backendError) {
      // 帳號鎖定 (AUTH_LOCKED)
      if (backendError.code === 'AUTH_LOCKED' || err?.status === 403) {
        this.errorMessage = backendError.message || '嘗試次數過多，帳號已被鎖定 15 分鐘';
        return;
      }
      // 登入驗證失敗 (AUTH_FAILED)
      if (backendError.code === 'AUTH_FAILED' || err?.status === 401) {
        this.errorMessage = backendError.message || '帳號或密碼錯誤';
        return;
      }
      if (backendError.message) {
        this.errorMessage = backendError.message;
        return;
      }
    }

    // 3. 嘗試解析標準 message
    if (err?.error?.message) {
      this.errorMessage = err.error.message;
      return;
    }

    // 4. 後端直接回傳字串時
    if (typeof err?.error === 'string' && err.error.trim()) {
      this.errorMessage = err.error;
      return;
    }

    // 5. 根據 HTTP 狀態碼提供友善訊息
    if (err?.status === 401) {
      this.errorMessage = '帳號或密碼錯誤';
    } else if (err?.status === 403) {
      this.errorMessage = '嘗試次數過多，帳號已被鎖定 15 分鐘';
    } else if (err?.status === 500) {
      if (!err?.error) {
        this.errorMessage = '後端連線失敗 (500 Proxy Error)，請確認 Spring Boot (8080 port) 是否已啟動';
      } else {
        this.errorMessage = '伺服器內部錯誤 (500)，請確認後端服務日誌';
      }
    } else {
      this.errorMessage = '登入失敗，請稍後再試';
    }
  }


  forget(): void {
    this.router.navigate(['/forget-password']);
  }
}
