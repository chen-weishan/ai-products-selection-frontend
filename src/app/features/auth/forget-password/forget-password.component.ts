import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
@Component({
  selector: 'app-forget-password',
  imports: [],
  templateUrl: './forget-password.component.html',
  styleUrl: './forget-password.component.scss',
})
export class ForgetPasswordComponent {
  private router = inject(Router);
  onLogin(): void {
    this.router.navigate(['/login']);
  }
}
