import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { BasicAuthService } from '../../../core/auth/basic-auth.service';
import { ProductService } from '../../products/product.service';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly basicAuth = inject(BasicAuthService);
  private readonly products = inject(ProductService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly submitting = signal(false);
  readonly loginError = signal<string | null>(null);

  readonly form = new FormGroup({
    username: new FormControl('buyer@ssds.dev', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    const { username, password } = this.form.getRawValue();
    this.basicAuth.setCredentials(username, password);
    this.submitting.set(true);
    this.loginError.set(null);

    this.products
      .load({ page: 0, size: 20 })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/products';
          void this.router.navigateByUrl(returnUrl);
        },
        error: () => {
          this.basicAuth.clearCredentials();
          this.loginError.set(this.products.error() ?? '登入失敗，請確認帳號與密碼');
        },
      });
  }
}
