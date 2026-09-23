import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { FestivalService } from './festival.service';
import { DialogService } from '../../services/dialog-service';
import {
  CALENDAR_TYPE_LABELS,
  CalendarType,
  ClimateNormal,
  Festival,
  FestivalCreateRequest,
  WINDOW_STATUS_LABELS,
} from '../../core/models/festival';

interface CategoryRow {
  id: number;
  name: string;
  leadTimeDays: number | null;
  idealTempMin: number | null;
  idealTempMax: number | null;
  tolerance: number | null;
}

/**
 * S-20 節慶檔期維護（FR-17）。版面依「畫面功能示意圖 v3.0」的五個標記。
 *
 * 示意圖標記 4「品項×節慶關聯度」不在本頁建置：關聯度是逐品項的屬性，
 * 維護入口在品項編輯頁（PUT /products/{id}/festival-affinity），本頁只做導引，
 * 與示意圖「本分頁不重複建置」的說明一致。
 *
 * 品類的前置天數與適溫區間由 GET /categories/profiles 載入現值（規格 §9 只定義了兩支 PUT，
 * 這支 GET 是為了讓維護頁看得到目前設定而新增的）。尚未設定的欄位後端回 null，
 * 表格顯示空白，不以 0 代替。
 */
@Component({
  selector: 'app-festivals',
  imports: [FormsModule],
  templateUrl: './festivals.component.html',
  styleUrl: './festivals.component.scss',
})
export class FestivalsComponent implements OnInit {
  private service = inject(FestivalService);
  private dialogService = inject(DialogService);

  readonly statusLabels = WINDOW_STATUS_LABELS;
  readonly calendarLabels = CALENDAR_TYPE_LABELS;

  readonly year = signal(new Date().getFullYear());
  readonly festivals = signal<Festival[]>([]);
  readonly categories = signal<CategoryRow[]>([]);
  readonly climateNormals = signal<ClimateNormal[]>([]);
  readonly selectedFestivalId = signal<number | null>(null);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  /** 時間窗示意用的前置天數。預設 21 天＝示意圖用的零食（國產）情境。 */
  readonly previewLeadDays = signal(21);

  readonly createForm = signal<FestivalCreateRequest>(blankCreateForm(new Date().getFullYear()));
  readonly showCreateForm = signal(false);

  readonly selectedFestival = computed(
    () => this.festivals().find((f) => f.id === this.selectedFestivalId()) ?? null,
  );

  /** 距節慶還有幾天（d）。負值代表已過。 */
  readonly daysUntilSelected = computed(() => {
    const festival = this.selectedFestival();
    if (!festival) {
      return null;
    }
    const today = startOfDay(new Date());
    const target = startOfDay(new Date(festival.festivalDate));
    return Math.round((target.getTime() - today.getTime()) / 86400000);
  });

  ngOnInit(): void {
    this.loadYear();
    this.loadCategories();
    this.loadClimateNormals();
  }

  loadYear(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.service.listByYear(this.year()).subscribe({
      next: (list) => {
        this.festivals.set(list);
        // 預設選第一個還沒過的檔期，沒有就選第一筆——採購最在意的是接下來要備什麼
        const upcoming = list.find((f) => f.windowStatus !== 'PASSED') ?? list[0];
        this.selectedFestivalId.set(upcoming?.id ?? null);
        this.loading.set(false);
      },
      error: (err) => this.fail(err),
    });
  }

  onYearChange(value: string): void {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 1900 && parsed <= 2100) {
      this.year.set(parsed);
      this.createForm.update((form) => ({ ...form, year: parsed }));
      this.loadYear();
    }
  }

  select(id: number): void {
    this.selectedFestivalId.set(id);
  }

  // ---- 標記 1：時間窗示意 ----

  /**
   * 四段時間窗在示意條上的位置（§FR-17-1）。
   *
   * 橫軸是「距節慶天數 d」，右端 d=0（節慶日），往左 d 變大。
   * 總長取 L + 30 + 30 天，讓「太早」那段也看得見。
   */
  readonly windowSegments = computed(() => {
    const lead = this.previewLeadDays();
    const total = lead + 60;
    const pct = (days: number) => (days / total) * 100;
    return [
      { label: '太早', weight: '0.0', width: pct(total - (lead + 30)), tone: 'zero' },
      { label: '黃金備貨期', weight: '1.0', width: pct(30), tone: 'gold' },
      { label: '補單期', weight: '0.5', width: pct(lead), tone: 'half' },
    ];
  });

  /** 目前的 d 落在哪一段。直接對照四段不等式，不另外換算。 */
  readonly currentWindowLabel = computed(() => {
    const d = this.daysUntilSelected();
    if (d === null) {
      return '—';
    }
    const lead = this.previewLeadDays();
    if (d < 0) return '已過（權重 0.0）';
    if (d < lead) return `補單期（權重 0.5）`;
    if (d <= lead + 30) return `黃金備貨期（權重 1.0）`;
    return '太早（權重 0.0）';
  });

  // ---- 標記 2：新增檔期 ----

  toggleCreateForm(): void {
    this.showCreateForm.update((open) => !open);
    if (this.showCreateForm()) {
      this.createForm.set(blankCreateForm(this.year()));
    }
  }

  onCalendarTypeChange(value: string): void {
    const calendarType = value as CalendarType;
    // 兩組欄位互斥：切換曆別時把另一組清掉，避免送出互相矛盾的內容
    this.createForm.update((form) => ({
      ...form,
      calendarType,
      festivalDate: calendarType === 'SOLAR' ? form.festivalDate : null,
      lunarMonth: calendarType === 'LUNAR' ? form.lunarMonth : null,
      lunarDay: calendarType === 'LUNAR' ? form.lunarDay : null,
    }));
  }

  patchForm<K extends keyof FestivalCreateRequest>(
    key: K,
    value: FestivalCreateRequest[K],
  ): void {
    this.createForm.update((form) => ({ ...form, [key]: value }));
  }

  submitCreate(): void {
    this.loading.set(true);
    this.clearMessages();
    this.service.create(this.createForm()).subscribe({
      next: (created) => {
        this.successMessage.set(
          `已新增「${created.festivalName}」，國曆日期 ${created.festivalDate}` +
            (created.calendarType === 'LUNAR' ? '（由農曆換算產生）' : ''),
        );
        this.showCreateForm.set(false);
        this.loading.set(false);
        this.loadYear();
      },
      error: (err) => this.fail(err),
    });
  }

  /** 刪除是不可逆的動作，先跳確認框——用全站共用的 DialogService，不自己做一套。 */
  remove(festival: Festival): void {
    this.dialogService
      .Confirm({
        title: '刪除檔期',
        message:
          `確定要刪除「${festival.festivalName}」（${festival.festivalDate}）嗎？
` +
          '已被評分結果引用的檔期會刪除失敗。',
        confirmText: '刪除',
        cancelText: '取消',
        isDanger: true,
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.doRemove(festival);
        }
      });
  }

  private doRemove(festival: Festival): void {
    this.loading.set(true);
    this.clearMessages();
    this.service.remove(festival.id).subscribe({
      next: () => {
        this.successMessage.set(`已刪除「${festival.festivalName}」`);
        this.loading.set(false);
        this.loadYear();
      },
      error: (err) => this.fail(err),
    });
  }

  // ---- 標記 3、5：品類設定 ----

  private loadCategories(): void {
    this.service.categoryProfiles().subscribe({
      next: (rows) =>
        this.categories.set(
          rows.map((row) => ({
            id: row.categoryId,
            name: row.categoryName,
            leadTimeDays: row.leadTimeDays,
            idealTempMin: row.idealTempMin,
            idealTempMax: row.idealTempMax,
            tolerance: row.tolerance,
          })),
        ),
      error: (err) => this.fail(err),
    });
  }

  /**
   * 把輸入框的字串轉成數字；空字串代表「清掉這個設定」，要回 null 不是 0。
   *
   * 直接用 `+value` 會把空字串變成 0——那就讓「還沒設定」與「設成 0」變成同一件事，
   * 正是 AC-17-5 要區分的兩種狀態。
   */
  parseNullableNumber(value: string): number | null {
    const trimmed = value.trim();
    return trimmed === '' ? null : Number(trimmed);
  }

  patchCategory(id: number, patch: Partial<CategoryRow>): void {
    this.categories.update((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  saveLeadTime(row: CategoryRow): void {
    if (row.leadTimeDays === null) {
      this.errorMessage.set('請先填入前置天數');
      return;
    }
    this.clearMessages();
    this.service.updateLeadTime(row.id, row.leadTimeDays).subscribe({
      next: (saved) => {
        this.patchCategory(saved.categoryId, { leadTimeDays: saved.leadTimeDays });
        this.successMessage.set(`${saved.categoryName} 前置天數已存為 ${saved.leadTimeDays} 天`);
      },
      error: (err) => this.fail(err),
    });
  }

  saveClimateProfile(row: CategoryRow): void {
    if (row.idealTempMin === null || row.idealTempMax === null) {
      this.errorMessage.set('適溫上下限都要填');
      return;
    }
    this.clearMessages();
    this.service
      .updateClimateProfile(row.id, {
        idealTempMin: row.idealTempMin,
        idealTempMax: row.idealTempMax,
        tolerance: row.tolerance,
      })
      .subscribe({
        next: (saved) => {
          this.patchCategory(saved.categoryId, {
            idealTempMin: saved.idealTempMin,
            idealTempMax: saved.idealTempMax,
            tolerance: saved.tolerance,
          });
          this.successMessage.set(
            `${saved.categoryName} 適溫 ${saved.idealTempMin}–${saved.idealTempMax}°C、` +
              `容忍 ${saved.tolerance}°C 已存檔`,
          );
        },
        error: (err) => this.fail(err),
      });
  }

  private loadClimateNormals(): void {
    this.service.climateNormals().subscribe({
      next: (rows) => this.climateNormals.set(rows),
      error: (err) => this.fail(err),
    });
  }

  // ---- 共用 ----

  private clearMessages(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  private fail(err: HttpErrorResponse): void {
    this.loading.set(false);
    // 後端錯誤封套是 §8.1 的 { success, error: { code, message } }
    this.errorMessage.set(err.error?.error?.message ?? err.message ?? '操作失敗');
  }
}

function blankCreateForm(year: number): FestivalCreateRequest {
  return {
    festivalCode: '',
    festivalName: '',
    calendarType: 'SOLAR',
    year,
    festivalDate: null,
    lunarMonth: null,
    lunarDay: null,
  };
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
