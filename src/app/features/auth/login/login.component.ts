import { Component, inject } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MockAccount } from '../../../core/auth/mock-users';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private authservice = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  rememberMe = false;
  isLoading = false;
  errorMessage = '';

  /** 模擬帳號列表供快速填入測試 */
  readonly mockAccounts = this.authservice.getMockAccounts();

  /** 快速填入指定角色的測試帳密 */
  fillMockAccount(account: MockAccount): void {
    this.email = account.email;
    this.password = account.password;
    this.errorMessage = '';
  }

  onLogin(): void {
    if (!this.email || !this.password) {
      this.errorMessage = '請輸入帳號或密碼';
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    this.authservice.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/products']);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.message || '帳號或密碼錯誤';
        console.error('login failed', err);
      }
    });
  }

  forget(): void {
    this.router.navigate(['/forget-password']);
  }
}
