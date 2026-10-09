import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { finalize } from 'rxjs';
import {
  ScheduleForm,
  ScheduleFrequency,
  WEEKDAYS,
  buildCron,
  describeCron,
  parseCron,
  sameSchedule,
} from '../cron-schedule';
import { RuntimeSchedule, RuntimeSettingsService } from '../runtime-settings.service';

/** 各排程的用途說明，讓管理員知道關掉會影響什麼。 */
const SCHEDULE_HINTS: Record<string, string> = {
  FULL_ANALYSIS: '每週對品項跑 AI 分析（情境判定、評論風險、進貨建議等），會消耗 A 軌配額。',
  FULL_ANALYSIS_RESUME: '本週週選品分析尚未處理到的品項，於其他天補跑。',
  PURE_SCORING: '每週用最新資料重算全部品項的分數與排行（不呼叫 AI）。',
  CALIBRATION: '每季初統計採購結果並產生權重校準建議，供採購主管審核。',
  HEAT_COMPOSITE: '每天採集各熱度來源並合成熱度指數。',
  HEAT_ALERT: '每天檢查熱度驟降與異常暴增，產生風險示警。',
};

export interface ScheduleDraft {
  item: RuntimeSchedule;
  enabled: boolean;
  form: ScheduleForm;
}

@Component({
  selector: 'app-admin-schedules',
  imports: [FormsModule, MatButtonModule, MatProgressSpinnerModule, MatSelectModule, MatSlideToggleModule],
  templateUrl: './admin-schedules.component.html',
  styleUrls: ['../admin-shared.scss', './admin-schedules.component.scss'],
})
export class AdminSchedulesComponent {
  private readonly api = inject(RuntimeSettingsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly weekdays = WEEKDAYS;
  readonly hints = SCHEDULE_HINTS;
  readonly frequencies: { value: ScheduleFrequency; label: string }[] = [
    { value: 'DAILY', label: '每天' },
    { value: 'WEEKLY', label: '每週' },
    { value: 'MONTHLY', label: '每月' },
    { value: 'QUARTERLY', label: '每季（1、4、7、10 月）' },
    { value: 'ADVANCED', label: '進階（cron 運算式）' },
  ];
  readonly days = Array.from({ length: 28 }, (_, i) => i + 1);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  drafts: ScheduleDraft[] = [];

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getSchedules()
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (config) => this.reset(config.items),
        error: (error: Error) => this.error.set(error.message),
      });
  }

  reset(items: RuntimeSchedule[] = this.drafts.map((draft) => draft.item)): void {
    this.drafts = items.map((item) => ({ item: { ...item }, enabled: item.enabled, form: parseCron(item.cron) }));
  }

  /** 切換頻率時沿用目前時間，切到進階時帶入目前算出的 cron 方便微調。 */
  changeFrequency(draft: ScheduleDraft, frequency: ScheduleFrequency): void {
    const current = this.cronOf(draft);
    if (frequency === 'ADVANCED') {
      draft.form = { ...draft.form, frequency, cron: current };
      return;
    }
    draft.form = { ...draft.form, frequency };
  }

  toggleWeekday(draft: ScheduleDraft, day: number): void {
    const selected = draft.form.weekdays.includes(day);
    if (selected && draft.form.weekdays.length === 1) return;
    draft.form = {
      ...draft.form,
      weekdays: selected ? draft.form.weekdays.filter((value) => value !== day) : [...draft.form.weekdays, day],
    };
  }

  cronOf(draft: ScheduleDraft): string {
    return buildCron(draft.form);
  }

  describe(draft: ScheduleDraft): string {
    return describeCron(this.cronOf(draft)) ?? '自訂排程';
  }

  errorOf(draft: ScheduleDraft): string | null {
    if (draft.form.frequency !== 'ADVANCED') {
      return /^\d{2}:\d{2}$/.test(draft.form.time) ? null : '請選擇執行時間';
    }
    const parts = draft.form.cron.trim().split(/\s+/);
    return parts.length === 6 ? null : 'cron 須為 6 欄：秒 分 時 日 月 星期';
  }

  isDirty(): boolean {
    return this.drafts.some((draft) => draft.enabled !== draft.item.enabled || !sameSchedule(this.cronOf(draft), draft.item.cron));
  }

  save(): void {
    if (this.saving() || this.drafts.some((draft) => this.errorOf(draft) != null)) return;
    // 時間沒改就送回原字串，避免只因寫法不同（範圍 vs 逗號）而改動設定與稽核紀錄
    const items = this.drafts.map((draft) => ({
      ...draft.item,
      cron: sameSchedule(this.cronOf(draft), draft.item.cron) ? draft.item.cron : this.cronOf(draft),
      enabled: draft.enabled,
    }));
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api.updateSchedules({ items })
      .pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.reset(saved.items);
          this.success.set('排程已儲存並重新註冊，下一次執行即依新時間。');
        },
        error: (error: Error) => this.error.set(error.message),
      });
  }
}
