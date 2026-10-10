import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { finalize } from 'rxjs';
import { RecoveryRuntimeConfig, RuntimeSettingsService } from '../runtime-settings.service';

@Component({
  selector: 'app-admin-recovery-settings',
  imports: [FormsModule, MatButtonModule, MatProgressSpinnerModule, MatSlideToggleModule],
  templateUrl: './admin-recovery-settings.component.html',
  styleUrls: ['../admin-shared.scss', './admin-recovery-settings.component.scss'],
})
export class AdminRecoverySettingsComponent {
  private readonly api = inject(RuntimeSettingsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  config: RecoveryRuntimeConfig | null = null;
  private saved: RecoveryRuntimeConfig | null = null;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getRecoveryConfig()
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (config) => this.reset(config),
        error: (error: Error) => this.error.set(error.message),
      });
  }

  reset(config: RecoveryRuntimeConfig | null = this.saved): void {
    if (config == null) return;
    this.saved = structuredClone(config);
    this.config = structuredClone(config);
  }

  isDirty(): boolean {
    return this.config != null && this.saved != null
      && JSON.stringify(this.config) !== JSON.stringify(this.saved);
  }

  errors(): string[] {
    const config = this.config;
    if (config == null) return [];
    if (![config.aiTaskRecoveryPollSeconds, config.importRecoveryPollSeconds]
      .every((value) => Number.isInteger(value) && value >= 1)) {
      return ['輪詢間隔須為至少 1 秒的整數'];
    }
    return [];
  }

  save(): void {
    const config = this.config;
    if (config == null || this.saving() || !this.isDirty() || this.errors().length) return;
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api.updateRecoveryConfig(config)
      .pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.reset(saved);
          this.success.set('設定已儲存；輪詢立即重新註冊，啟動補跑開關於下次啟動套用。');
        },
        error: (error: Error) => this.error.set(error.message),
      });
  }
}
