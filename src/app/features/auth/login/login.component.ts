import { Component, inject } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service'
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
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
  erroeMessage = '';



  onLogin(): void {
    if (!this.email || !this.password) {
      this.erroeMessage = '請輸入帳號或密碼';
      return;
    }
    this.isLoading = true;
    this.erroeMessage = '';
    this.authservice.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/products']);
      },
      error: (err) => {
        this.isLoading = false;
        this.erroeMessage = '帳號或密碼錯誤';
        console.error('login failed', err)
      }
    })

  }

  forget() {
    this.router.navigate(['/forget-password']);
  }
}
