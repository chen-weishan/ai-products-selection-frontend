import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EMPTY, Subject, Subscription, catchError, forkJoin, of, switchMap, takeUntil, timer } from 'rxjs';

import {
  ManualHeatTagControllerService,
  ManualHeatTagResponse,
  ProductControllerService,
  ProductReferenceControllerService,
} from '../../api';
import { AuthService } from '../../core/auth/auth.service';
import { SKIP_LOADING } from '../../core/http/loading-interceptor';
import { HttpContext } from '@angular/common/http';

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
  private readonly destroyRef = inject(DestroyRef);
  private listSubscription?: Subscription;
  private searchSubscription?: Subscription;
  private initialized = false;
  private loadedIdentity = '';
  readonly currentUser = this.authService.currentUser;
  readonly canWrite = computed(() => this.authService.hasRole(['BUYER', 'BUYER_LEAD', 'DATA_ADMIN', 'SYS_ADMIN']));
  readonly listError = signal('');
  readonly searchError = signal('');
  readonly platformError = signal('');
  readonly hasMoreProducts = signal(false);
  private productSearchPage = 0;
  private searchedQuery = '';

  private getJsonOptions() {
    return {
      httpHeaderAccept: 'application/json' as any,
      context: new HttpContext().set(SKIP_LOADING, true)
    };
  }

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
  readonly selectedProductKeywordIds = signal<readonly number[]>([]);
  readonly isCheckingProductTarget = signal(false);
  readonly targetError = signal('');
  readonly searchQuery = signal<string>('');
  readonly searchResults = signal<TargetOption[]>([]);
  readonly isSearching = signal<boolean>(false);
  readonly isSearchOpen = signal<boolean>(false);

  readonly platformOptions = PLATFORM_OPTIONS;

  private readonly urlInput$ = new Subject<string>();
  private readonly searchInput$ = new Subject<string | null>();
  private readonly identityChanged$ = new Subject<void>();
  private originalObservedAt?: string;
  private originalObservedInput?: string;

  constructor() {
    effect(() => {
      const user = this.currentUser();
      const identity = JSON.stringify([user?.id, user?.roles, user?.role]);
      if (this.initialized && identity !== this.loadedIdentity) {
        this.loadedIdentity = identity;
        this.identityChanged$.next();
        this.isSubmitting.set(false);
        this.cancelEdit();
        this.searchSubscription?.unsubscribe();
        this.searchResults.set([]);
        this.isSearchOpen.set(false);
        this.loadTags();
      }
    });
    this.destroyRef.onDestroy(() => {
      this.listSubscription?.unsubscribe();
      this.searchSubscription?.unsubscribe();
    });
  }

  readonly urlError = computed(() => {
    const value = this.sourceUrl().trim();
    if (!value) return '';
    if (value.length > 512) return '來源連結不可超過 512 字';
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) throw new Error();
      return '';
    } catch {
      return '請輸入完整的 http:// 或 https:// 連結';
    }
  });
  readonly noteError = computed(() => this.note().length > 255 ? '備註不可超過 255 字' : '');
  readonly timeError = computed(() => !this.observedAt() || !Number.isFinite(new Date(this.observedAt()).getTime()) ? '請輸入有效的觀察時間' : '');

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
    const hasTarget = this.selectedKeyword() !== null
      || (this.selectedProduct() !== null
        && (this.editingTagId() !== null || this.selectedProductKeywordIds().length > 0));
    return this.canWrite() && hasUrl && hasTarget && !this.urlError() && !this.noteError() && !this.timeError()
      && this.heatLevel() >= 1 && this.heatLevel() <= 5
      && PLATFORM_OPTIONS.some(p => p.value === this.platform())
      && (!this.isResolvingPlatform() || this.isPlatformManuallyOverridden())
      && (!this.platformError() || this.isPlatformManuallyOverridden())
      && !this.isCheckingProductTarget() && !this.targetError() && !this.isSubmitting();
  });

  readonly submitBlockedReason = computed(() => {
    if (!this.canWrite()) return '目前登入角色沒有新增人工標記權限。';
    if (!this.sourceUrl().trim()) return '請先輸入來源連結。';
    if (this.urlError()) return this.urlError();
    if (!this.selectedProduct() && !this.selectedKeyword()) return '請選擇關聯品項或趨勢關鍵字。';
    if (this.isCheckingProductTarget()) return '正在確認商品綁定的趨勢關鍵字。';
    if (this.targetError()) return this.targetError();
    if (this.selectedProduct() && this.editingTagId() === null && this.selectedProductKeywordIds().length === 0) {
      return '此商品沒有可套用的趨勢關鍵字。';
    }
    if (this.isResolvingPlatform() && !this.isPlatformManuallyOverridden()) return '正在辨識來源平台。';
    if (this.platformError() && !this.isPlatformManuallyOverridden()) return '平台辨識失敗，請手動選擇平台。';
    if (this.noteError()) return this.noteError();
    if (this.timeError()) return this.timeError();
    if (this.isSubmitting()) return '標記正在送出。';
    return '';
  });

  ngOnInit(): void {
    const user = this.currentUser();
    this.loadedIdentity = JSON.stringify([user?.id, user?.roles, user?.role]);
    this.initialized = true;
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
      switchMap(url => {
        if (!url.trim() || this.urlError() || !this.canWrite()) return EMPTY;
        return timer(400).pipe(switchMap(() => this.heatTagApi.resolvePlatform(
          { resolvePlatformRequest: { sourceUrl: url.trim() } }, 'body', false,
          this.getJsonOptions()
        ).pipe(catchError(() => {
          if (!this.isPlatformManuallyOverridden()) {
            this.platformError.set('平台辨識失敗，請手動選擇平台後送出');
          }
          this.isResolvingPlatform.set(false);
          return EMPTY;
        }))));
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(res => {
      this.isResolvingPlatform.set(false);
      if (this.isPlatformManuallyOverridden()) return;
      const detected = res.data?.platform;
      if (detected && PLATFORM_OPTIONS.some(p => p.value === detected)) {
        this.platform.set(detected);
        this.platformError.set('');
        this.platformResolvedLabel.set(`已辨識　${this.getPlatformLabel(detected)}`);
      } else {
        this.platformError.set('無法辨識平台，請手動選擇');
      }
      this.cdr.markForCheck();
    });
  }

  onUrlChange(value: string): void {
    this.sourceUrl.set(value);
    this.isPlatformManuallyOverridden.set(false);
    this.platformResolvedLabel.set('');
    this.platformError.set('');
    this.platform.set('OTHER');
    this.isResolvingPlatform.set(!!value.trim() && !this.urlError());
    this.urlInput$.next(value);
  }

  // ── 手動切換平台（AC-14-1） ──
  selectPlatform(value: string): void {
    this.platform.set(value);
    this.isPlatformManuallyOverridden.set(true);
    this.platformError.set('');
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
      switchMap(query => query === null ? EMPTY : timer(300).pipe(switchMap(() => of(query)))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(query => this.performSearch(query));
  }

  onSearchInput(query: string): void {
    this.searchSubscription?.unsubscribe();
    this.searchQuery.set(query);
    this.searchResults.set([]);
    this.searchError.set('');
    this.hasMoreProducts.set(false);
    this.isSearching.set(true);
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
    this.searchSubscription?.unsubscribe();
    this.productSearchPage = 0;
    this.searchedQuery = query.trim();
    this.isSearching.set(true);
    const jsonOptions = this.getJsonOptions();
    const keywordParams = this.searchedQuery ? { keyword: this.searchedQuery, enabled: true } : { enabled: true };
    this.searchSubscription = forkJoin({
      keywords: this.referenceApi.getTrendKeywords(keywordParams, 'body', false, jsonOptions).pipe(
        catchError(err => {
          this.searchError.set(`關鍵字搜尋失敗：${this.errorMessage(err)}`);
          return of(null);
        })
      ),
      products: this.productApi.search({ keyword: this.searchedQuery || undefined, size: 20, page: 0 }, 'body', false, jsonOptions).pipe(
        catchError(err => {
          this.searchError.update(message => [message, `品項搜尋失敗：${this.errorMessage(err)}`].filter(Boolean).join('；'));
          return of(null);
        })
      )
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ keywords, products }) => {
      const kwOptions: TargetOption[] = (keywords?.data || []).filter(k => k.id != null).map(k => ({
        type: 'KEYWORD', id: k.id!, title: k.keyword || '', sub: '趨勢關鍵字'
      }));
      this.searchResults.set([...kwOptions, ...this.productOptions(products?.data?.content || [])]);
      this.hasMoreProducts.set((products?.data?.totalPages || 0) > 1);
      this.isSearching.set(false);
      this.cdr.markForCheck();
    });
  }

  loadMoreProducts(): void {
    if (this.isSearching() || !this.hasMoreProducts()) return;
    const nextPage = this.productSearchPage + 1;
    this.isSearching.set(true);
    this.searchSubscription = this.productApi.search({
      keyword: this.searchedQuery || undefined, size: 20, page: nextPage
    }, 'body', false, this.getJsonOptions()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.productSearchPage = nextPage;
        const options = this.productOptions(res.data?.content || []);
        this.searchResults.update(current => [...current, ...options.filter(p => !current.some(c => c.type === p.type && c.id === p.id))]);
        this.hasMoreProducts.set(nextPage + 1 < (res.data?.totalPages || 0));
        this.isSearching.set(false);
      },
      error: err => {
        this.searchError.set(`載入更多失敗：${this.errorMessage(err)}`);
        this.isSearching.set(false);
      }
    });
  }

  private productOptions(products: { id?: number; name?: string; categoryName?: string; trackType?: string }[]): TargetOption[] {
    return products.filter(p => p.id != null).map(p => ({
      type: 'PRODUCT', id: p.id!, title: p.name || '', sub: p.categoryName || '既有品項', track: p.trackType
    }));
  }

  private errorMessage(err: any): string {
    return err?.error?.error?.message || err?.error?.message || (err?.status === 0 ? '無法連線至伺服器' : err?.message) || '請稍後重試';
  }

  selectTarget(option: TargetOption): void {
    this.cancelSearch();
    this.targetError.set('');
    this.selectedProductKeywordIds.set([]);
    if (option.type === 'PRODUCT') {
      this.selectedProduct.set({ id: option.id, name: option.title, track: option.track });
      this.selectedKeyword.set(null);
      this.isCheckingProductTarget.set(true);
      this.productApi.getById(
        { id: option.id },
        'body',
        false,
        this.getJsonOptions(),
      ).pipe(takeUntil(this.identityChanged$), takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (response) => {
          if (this.selectedProduct()?.id !== option.id) return;
          const keywordIds = Array.from(response.data?.keywordIds ?? []);
          this.selectedProductKeywordIds.set(keywordIds);
          this.isCheckingProductTarget.set(false);
          if (keywordIds.length === 0) {
            this.targetError.set('此商品尚未綁定趨勢關鍵字，無法產生人工熱度權重；請先到商品編輯頁補上關鍵字。');
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          if (this.selectedProduct()?.id !== option.id) return;
          this.isCheckingProductTarget.set(false);
          this.targetError.set(`無法確認商品的趨勢關鍵字：${this.errorMessage(err)}`);
          this.cdr.markForCheck();
        },
      });
    } else {
      this.selectedKeyword.set({ id: option.id, keyword: option.title });
      this.selectedProduct.set(null);
      this.isCheckingProductTarget.set(false);
    }
    this.searchQuery.set('');
    this.isSearchOpen.set(false);
    this.cdr.markForCheck();
  }

  clearSelectedTarget(): void {
    this.cancelSearch();
    this.selectedProduct.set(null);
    this.selectedKeyword.set(null);
    this.selectedProductKeywordIds.set([]);
    this.isCheckingProductTarget.set(false);
    this.targetError.set('');
    this.searchQuery.set('');
    this.cdr.markForCheck();
  }

  private cancelSearch(): void {
    this.searchInput$.next(null);
    this.searchSubscription?.unsubscribe();
    this.isSearching.set(false);
    this.isSearchOpen.set(false);
    this.searchError.set('');
    this.searchResults.set([]);
    this.hasMoreProducts.set(false);
  }

  // ── 載入標記清單 ──
  loadTags(): void {
    this.listSubscription?.unsubscribe();
    this.listError.set('');
    this.tags.set([]);
    this.isLoadingList.set(true);
    const jsonOptions = this.getJsonOptions();
    this.listSubscription = this.heatTagApi.list1(
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
        this.listError.set(this.errorMessage(err));
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
    const jsonOptions = this.getJsonOptions();
    const observedInstant = this.editingTagId() !== null && this.originalObservedAt && this.observedAt() === this.originalObservedInput
      ? this.originalObservedAt! : new Date(this.observedAt()).toISOString();

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
      ).pipe(takeUntil(this.identityChanged$), takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.snackBar.open('標記更新成功', '關閉', { duration: 3000 });
          this.cancelEdit();
          this.loadTags();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          console.error('[HeatTags] 更新標記失敗:', err);
          const msg = this.errorMessage(err);
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

      this.heatTagApi.create2(
        { manualHeatTagCreateRequest: createPayload as any },
        'body',
        false,
        jsonOptions
      ).pipe(takeUntil(this.identityChanged$), takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.snackBar.open('人工熱度標記建立成功！', '關閉', { duration: 3000 });
          this.resetForm();
          this.loadTags();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          console.error('[HeatTags] 新增標記失敗:', err);
          const msg = this.errorMessage(err);
          this.snackBar.open(`標記失敗: ${msg}`, '關閉', { duration: 4000 });
          this.cdr.markForCheck();
        }
      });
    }
  }

  // ── 進入編輯模式 ──
  startEdit(tag: ManualHeatTagResponse): void {
    if (!tag.id || !this.canModifyTag(tag) || this.isSubmitting()) return;
    this.cancelSearch();
    this.resetObservedTime();
    this.editingTagId.set(tag.id);
    this.onUrlChange('');
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
    this.originalObservedAt = tag.observedAt;
    this.originalObservedInput = this.observedAt();

    if (tag.productId) {
      this.selectedProduct.set({ id: tag.productId, name: tag.productName || `品項 #${tag.productId}`, track: this.selectedProduct()?.id === tag.productId ? this.selectedProduct()?.track : undefined });
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
    this.originalObservedAt = undefined;
    this.originalObservedInput = undefined;
    this.onUrlChange('');
    this.platform.set('OTHER');
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
    if (!tag.id || !this.canModifyTag(tag) || this.isSubmitting()) return;
    const confirmName = tag.productName || tag.keywordText || '此筆標記';
    if (!confirm(`確定要刪除「${confirmName}」的熱度標記嗎？`)) {
      return;
    }

    const jsonOptions = this.getJsonOptions();
    this.heatTagApi.delete1({ id: tag.id }, 'body', false, jsonOptions)
      .pipe(takeUntil(this.identityChanged$), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.snackBar.open('標記已刪除', '關閉', { duration: 2500 });
        if (this.editingTagId() === tag.id) {
          this.cancelEdit();
        }
        this.loadTags();
      },
      error: (err) => {
        console.error('[HeatTags] 刪除標記失敗:', err);
        const msg = this.errorMessage(err);
        this.snackBar.open(`刪除失敗: ${msg}`, '關閉', { duration: 3000 });
      }
    });
  }

  canModifyTag(tag: ManualHeatTagResponse): boolean {
    const user = this.authService.currentUser();
    if (!user || !this.canWrite()) return false;
    // 管理員可代管
    if (this.authService.hasRole(['SYS_ADMIN'])) return true;
    // 本人建立
    const id = Number(user.id);
    return Number.isFinite(id) && id > 0 && tag.taggedById === id;
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
      if (!Number.isFinite(target)) return '-';
      const diffMs = Date.now() - target;
      if (diffMs < 0) return '未來時間';
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
