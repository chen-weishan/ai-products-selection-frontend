import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import {
  ManualHeatTagControllerService,
  ManualHeatTagResponse,
  ProductControllerService,
  ProductReferenceControllerService,
} from '../../api';
import { AuthService } from '../../core/auth/auth.service';

export interface TargetOption {
  type: 'PRODUCT' | 'KEYWORD';
  id: number;
  title: string;
  sub?: string;
  track?: string;
}

export const PLATFORM_OPTIONS = [
  { value: 'THREADS', label: 'Threads', icon: 'threads' },
  { value: 'TIKTOK', label: 'TikTok', icon: 'tiktok' },
  { value: 'XIAOHONGSHU', label: '小紅書', icon: 'red' },
  { value: 'INSTAGRAM', label: 'Instagram', icon: 'ig' },
  { value: 'FACEBOOK', label: 'Facebook', icon: 'fb' },
  { value: 'OTHER', label: '其他', icon: 'other' },
];

@Component({
  selector: 'app-heat-tags',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule
  ],
  providers: [DatePipe],
  templateUrl: './heat-tags.component.html',
  styleUrl: './heat-tags.component.scss'
})
export class HeatTagsComponent implements OnInit {
  private readonly heatTagApi = inject(ManualHeatTagControllerService);
  private readonly productApi = inject(ProductControllerService);
  private readonly referenceApi = inject(ProductReferenceControllerService);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly elementRef = inject(ElementRef);

  // ── 清單狀態 ──
  readonly tags = signal<ManualHeatTagResponse[]>([]);
  readonly scope = signal<'MINE' | 'ALL'>('ALL');
  readonly days = signal<number>(30);
  readonly isLoadingList = signal<boolean>(false);
  readonly pageSize = signal<number>(10);
  readonly pageIndex = signal<number>(0);
  readonly paginatedTags = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.tags().slice(start, start + this.pageSize());
  });

  // ── 表單狀態 ──
  readonly sourceUrl = signal<string>('');
  readonly platform = signal<string>('THREADS');
  readonly platformResolvedLabel = signal<string>('');
  readonly isPlatformManuallyOverridden = signal<boolean>(false);
  readonly isResolvingPlatform = signal<boolean>(false);
  readonly heatLevel = signal<number>(5);
  readonly note = signal<string>('');
  readonly observedAt = signal<string>('');
  readonly isSubmitting = signal<boolean>(false);

  // ── 編輯中狀態 ──
  readonly editingTagId = signal<number | null>(null);

  // ── 標的關聯搜尋 ──
  readonly selectedProduct = signal<{ id: number; name: string; track?: string } | null>(null);
  readonly selectedKeyword = signal<{ id: number; keyword: string } | null>(null);
  readonly searchQuery = signal<string>('');
  readonly searchResults = signal<TargetOption[]>([]);
  readonly isSearching = signal<boolean>(false);
  readonly isSearchOpen = signal<boolean>(false);

  readonly platformOptions = PLATFORM_OPTIONS;

  private readonly urlInput$ = new Subject<string>();
  private readonly searchInput$ = new Subject<string>();

  // ── 計算屬性 ──
  readonly weeklyCount = computed(() => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return this.tags().filter(tag => {
      if (!tag.observedAt) return false;
      return new Date(tag.observedAt).getTime() >= oneWeekAgo;
    }).length;
  });

  readonly isFormValid = computed(() => {
    const hasUrl = this.sourceUrl().trim().length > 0;
    const hasTarget = this.selectedProduct() !== null || this.selectedKeyword() !== null;
    return hasUrl && hasTarget && !this.isSubmitting();
  });

  ngOnInit(): void {
    this.resetObservedTime();
    this.loadTags();
    this.setupUrlDebounce();
    this.setupSearchDebounce();
  }

  resetObservedTime(): void {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    this.observedAt.set(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
  }

  // ── URL 自動辨識平台 ──
  private setupUrlDebounce(): void {
    this.urlInput$.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(url => {
      if (!url || !url.trim() || url.trim().length < 4) {
        this.platformResolvedLabel.set('');
        return;
      }
      this.isResolvingPlatform.set(true);
      const jsonOptions = { httpHeaderAccept: 'application/json' as any };
      this.heatTagApi.resolvePlatform(
        { resolvePlatformRequest: { sourceUrl: url.trim() } },
        'body',
        false,
        jsonOptions
      ).subscribe({
        next: (res: any) => {
          this.isResolvingPlatform.set(false);
          const detected = res?.data?.platform || res?.platform;
          if (detected) {
            if (!this.isPlatformManuallyOverridden()) {
              this.platform.set(detected);
            }
            this.platformResolvedLabel.set(`已辨識　${this.getPlatformLabel(detected)}`);
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.isResolvingPlatform.set(false);
          this.cdr.markForCheck();
        }
      });
    });
  }

  onUrlChange(value: string): void {
    this.sourceUrl.set(value);
    this.isPlatformManuallyOverridden.set(false);
    this.urlInput$.next(value);
  }

  // ── 手動切換平台（AC-14-1） ──
  selectPlatform(value: string): void {
    this.platform.set(value);
    this.isPlatformManuallyOverridden.set(true);
    this.platformResolvedLabel.set(`手動指定　${this.getPlatformLabel(value)}`);
    this.cdr.markForCheck();
  }

  // ── 等級選取 ──
  selectHeatLevel(level: number): void {
    this.heatLevel.set(level);
    this.cdr.markForCheck();
  }

  // ── 關聯品項／關鍵字搜尋 ──
  private setupSearchDebounce(): void {
    this.searchInput$.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      this.performSearch(query);
    });
  }

  onSearchInput(query: string): void {
    this.searchQuery.set(query);
    this.isSearchOpen.set(true);
    this.searchInput$.next(query);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isSearchOpen()) return;
    const target = event.target as HTMLElement;
    const wrapper = this.elementRef.nativeElement.querySelector('.search-field-wrapper');
    if (wrapper && !wrapper.contains(target)) {
      this.isSearchOpen.set(false);
      this.cdr.markForCheck();
    }
  }

  onSearchFocusOut(event: FocusEvent): void {
    const related = event.relatedTarget as HTMLElement;
    const wrapper = this.elementRef.nativeElement.querySelector('.search-field-wrapper');
    if (wrapper && !wrapper.contains(related)) {
      this.isSearchOpen.set(false);
      this.cdr.markForCheck();
    }
  }

  private performSearch(query: string): void {
    if (!query || query.trim().length === 0) {
      this.loadDefaultTargets();
      return;
    }
    this.isSearching.set(true);
    const trimmed = query.trim();
    const jsonOptions = { httpHeaderAccept: 'application/json' as any };

    // 同時搜尋關鍵字與品項
    this.referenceApi.getTrendKeywords({ keyword: trimmed, enabled: true }, 'body', false, jsonOptions).subscribe({
      next: (kwRes: any) => {
        const kwData = kwRes?.data || kwRes || [];
        const keywordOptions: TargetOption[] = (Array.isArray(kwData) ? kwData : []).map(k => ({
          type: 'KEYWORD' as const,
          id: k.id,
          title: k.keyword,
          sub: '趨勢關鍵字'
        }));

        this.productApi.search({ keyword: trimmed, size: 5 } as any, 'body', false, jsonOptions).subscribe({
          next: (prodRes: any) => {
            this.isSearching.set(false);
            const content = prodRes?.data?.content || prodRes?.data || [];
            const productOptions: TargetOption[] = (Array.isArray(content) ? content : []).map(p => ({
              type: 'PRODUCT' as const,
              id: p.id,
              title: p.name,
              sub: p.categoryName || '既有品項',
              track: p.trackType || 'A'
            }));
            this.searchResults.set([...keywordOptions, ...productOptions]);
            this.cdr.markForCheck();
          },
          error: () => {
            this.isSearching.set(false);
            this.searchResults.set(keywordOptions);
            this.cdr.markForCheck();
          }
        });
      },
      error: () => {
        this.isSearching.set(false);
        this.searchResults.set([]);
        this.cdr.markForCheck();
      }
    });
  }

  private loadDefaultTargets(): void {
    this.isSearching.set(true);
    const jsonOptions = { httpHeaderAccept: 'application/json' as any };
    this.referenceApi.getTrendKeywords({ enabled: true }, 'body', false, jsonOptions).subscribe({
      next: (res: any) => {
        this.isSearching.set(false);
        const data = res?.data || res || [];
        const kwOptions: TargetOption[] = (Array.isArray(data) ? data.slice(0, 8) : []).map(k => ({
          type: 'KEYWORD' as const,
          id: k.id,
          title: k.keyword,
          sub: '趨勢關鍵字'
        }));
        this.searchResults.set(kwOptions);
        this.cdr.markForCheck();
      },
      error: () => {
        this.isSearching.set(false);
        this.searchResults.set([]);
        this.cdr.markForCheck();
      }
    });
  }

  selectTarget(option: TargetOption): void {
    if (option.type === 'PRODUCT') {
      this.selectedProduct.set({ id: option.id, name: option.title, track: option.track });
      this.selectedKeyword.set(null);
    } else {
      this.selectedKeyword.set({ id: option.id, keyword: option.title });
      this.selectedProduct.set(null);
    }
    this.searchQuery.set('');
    this.isSearchOpen.set(false);
    this.cdr.markForCheck();
  }

  clearSelectedTarget(): void {
    this.selectedProduct.set(null);
    this.selectedKeyword.set(null);
    this.searchQuery.set('');
    this.cdr.markForCheck();
  }

  // ── 載入標記清單 ──
  loadTags(): void {
    this.isLoadingList.set(true);
    const jsonOptions = { httpHeaderAccept: 'application/json' as any };
    this.heatTagApi.list1(
      { scope: this.scope(), days: this.days() },
      'body',
      false,
      jsonOptions
    ).subscribe({
      next: (res: any) => {
        this.isLoadingList.set(false);
        const data = res?.data || res;
        this.tags.set(Array.isArray(data) ? data : []);
        this.pageIndex.set(0);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoadingList.set(false);
        console.error('[HeatTags] 載入標記清單失敗:', err);
        this.tags.set([]);
        this.pageIndex.set(0);
        this.cdr.markForCheck();
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageSize.set(event.pageSize);
    this.pageIndex.set(event.pageIndex);
    this.cdr.markForCheck();
  }

  switchScope(newScope: 'MINE' | 'ALL'): void {
    if (this.scope() !== newScope) {
      this.scope.set(newScope);
      this.loadTags();
    }
  }

  // ── 送出標記 ──
  submitTag(): void {
    if (!this.isFormValid()) return;

    this.isSubmitting.set(true);
    const jsonOptions = { httpHeaderAccept: 'application/json' as any };
    const observedInstant = this.observedAt() ? new Date(this.observedAt()).toISOString() : new Date().toISOString();

    const editId = this.editingTagId();
    if (editId !== null) {
      // 編輯既有標記
      const updatePayload = {
        sourceUrl: this.sourceUrl().trim(),
        platform: this.platform() as any,
        heatLevel: this.heatLevel(),
        observedAt: observedInstant,
        note: this.note().trim() || undefined
      };

      this.heatTagApi.update1(
        { id: editId, manualHeatTagUpdateRequest: updatePayload as any },
        'body',
        false,
        jsonOptions
      ).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.snackBar.open('標記更新成功', '關閉', { duration: 3000 });
          this.cancelEdit();
          this.loadTags();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          console.error('[HeatTags] 更新標記失敗:', err);
          const msg = err?.error?.message || err?.message || '更新失敗';
          this.snackBar.open(`更新失敗: ${msg}`, '關閉', { duration: 4000 });
          this.cdr.markForCheck();
        }
      });
    } else {
      // 新增標記
      const createPayload = {
        sourceUrl: this.sourceUrl().trim(),
        platform: this.platform() as any,
        heatLevel: this.heatLevel(),
        productId: this.selectedProduct()?.id,
        keywordId: this.selectedKeyword()?.id,
        observedAt: observedInstant,
        note: this.note().trim() || undefined
      };

      this.heatTagApi.create1(
        { manualHeatTagCreateRequest: createPayload as any },
        'body',
        false,
        jsonOptions
      ).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.snackBar.open('人工熱度標記建立成功！', '關閉', { duration: 3000 });
          this.resetForm();
          this.loadTags();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          console.error('[HeatTags] 新增標記失敗:', err);
          const msg = err?.error?.message || err?.message || '新增失敗';
          this.snackBar.open(`標記失敗: ${msg}`, '關閉', { duration: 4000 });
          this.cdr.markForCheck();
        }
      });
    }
  }

  // ── 進入編輯模式 ──
  startEdit(tag: ManualHeatTagResponse): void {
    if (!tag.id) return;
    this.editingTagId.set(tag.id);
    this.sourceUrl.set(tag.sourceUrl || '');
    this.platform.set(tag.platform || 'THREADS');
    this.isPlatformManuallyOverridden.set(true);
    this.platformResolvedLabel.set(`手動指定　${this.getPlatformLabel(tag.platform)}`);
    this.heatLevel.set(tag.heatLevel || 5);
    this.note.set(tag.note || '');

    if (tag.observedAt) {
      const d = new Date(tag.observedAt);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      this.observedAt.set(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
    }

    if (tag.productId) {
      this.selectedProduct.set({ id: tag.productId, name: tag.productName || `品項 #${tag.productId}` });
      this.selectedKeyword.set(null);
    } else if (tag.keywordId) {
      this.selectedKeyword.set({ id: tag.keywordId, keyword: tag.keywordText || `關鍵字 #${tag.keywordId}` });
      this.selectedProduct.set(null);
    }

    // 平滑捲動至表單卡片
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    this.editingTagId.set(null);
    this.resetForm();
  }

  resetForm(): void {
    this.sourceUrl.set('');
    this.platform.set('THREADS');
    this.platformResolvedLabel.set('');
    this.isPlatformManuallyOverridden.set(false);
    this.heatLevel.set(5);
    this.note.set('');
    this.clearSelectedTarget();
    this.resetObservedTime();
    this.cdr.markForCheck();
  }

  // ── 刪除標記 ──
  deleteTag(tag: ManualHeatTagResponse): void {
    if (!tag.id) return;
    const confirmName = tag.productName || tag.keywordText || '此筆標記';
    if (!confirm(`確定要刪除「${confirmName}」的熱度標記嗎？`)) {
      return;
    }

    const jsonOptions = { httpHeaderAccept: 'application/json' as any };
    this.heatTagApi.delete1({ id: tag.id }, 'body', false, jsonOptions).subscribe({
      next: () => {
        this.snackBar.open('標記已刪除', '關閉', { duration: 2500 });
        if (this.editingTagId() === tag.id) {
          this.cancelEdit();
        }
        this.loadTags();
      },
      error: (err) => {
        console.error('[HeatTags] 刪除標記失敗:', err);
        const msg = err?.error?.message || err?.message || '刪除失敗';
        this.snackBar.open(`刪除失敗: ${msg}`, '關閉', { duration: 3000 });
      }
    });
  }

  canModifyTag(tag: ManualHeatTagResponse): boolean {
    const user = this.authService.currentUser();
    if (!user) return false;
    // 管理員可代管
    if (this.authService.hasRole(['SYS_ADMIN'])) return true;
    // 本人建立
    return tag.taggedById === Number(user.id) || tag.taggedByName === user.name;
  }

  // ── 格式化工具 ──
  getPlatformLabel(plat?: string): string {
    if (!plat) return '未知';
    const found = PLATFORM_OPTIONS.find(p => p.value === plat.toUpperCase());
    return found ? found.label : plat;
  }

  getPlatformClass(plat?: string): string {
    const p = (plat || '').toUpperCase();
    if (p.includes('THREAD')) return 'plat-threads';
    if (p.includes('TIKTOK')) return 'plat-tiktok';
    if (p.includes('RED') || p.includes('XIAOHONGSHU')) return 'plat-red';
    if (p.includes('INSTAGRAM') || p === 'IG') return 'plat-ig';
    if (p.includes('FACEBOOK') || p === 'FB') return 'plat-fb';
    return 'plat-other';
  }

  formatRelativeTime(isoString?: string): string {
    if (!isoString) return '-';
    try {
      const target = new Date(isoString).getTime();
      const diffMs = Date.now() - target;
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);

      if (diffDay === 0) return '今天';
      if (diffDay === 1) return '昨天';
      if (diffDay < 30) return `${diffDay} 天前`;
      return `${diffDay} 天前 (已失效)`;
    } catch {
      return isoString;
    }
  }

  getWeightDisplay(weight?: number): { text: string; cssClass: string } {
    if (weight === undefined || weight === null) {
      return { text: '-', cssClass: '' };
    }
    if (weight >= 0.99) {
      return { text: '100%', cssClass: 'status-badge compact status-normal' };
    }
    if (weight >= 0.49) {
      return { text: '50%', cssClass: 'status-badge compact status-quota' };
    }
    return { text: '已失效', cssClass: 'status-badge compact override-badge' };
  }
}
