import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, Subject, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { HeatTagsComponent } from './heat-tags.component';
import {
  ManualHeatTagControllerService,
  ManualHeatTagResponse,
  ProductControllerService,
  ProductReferenceControllerService,
} from '../../api';
import { AuthService } from '../../core/auth/auth.service';

describe('HeatTagsComponent', () => {
  let component: HeatTagsComponent;
  let fixture: ComponentFixture<HeatTagsComponent>;

  let mockHeatTagService: {
    list1: ReturnType<typeof vi.fn>;
    resolvePlatform: ReturnType<typeof vi.fn>;
    create1: ReturnType<typeof vi.fn>;
    update1: ReturnType<typeof vi.fn>;
    delete1: ReturnType<typeof vi.fn>;
  };

  let mockProductService: {
    search: ReturnType<typeof vi.fn>;
  };

  let mockReferenceService: {
    getTrendKeywords: ReturnType<typeof vi.fn>;
  };

  let mockCurrentUser = signal<any>({ id: '1', name: '王小美', roles: ['BUYER'] });

  let mockAuthService: {
    currentUser: typeof mockCurrentUser;
    hasRole: ReturnType<typeof vi.fn>;
  };

  let mockSnackBar: {
    open: ReturnType<typeof vi.fn>;
  };

  const sampleTags: ManualHeatTagResponse[] = [
    {
      id: 1,
      productId: 101,
      productName: '石墨烯智能溫控眼罩',
      sourceUrl: 'https://www.threads.net/@user/post/12345',
      platform: 'THREADS',
      heatLevel: 5,
      currentWeight: 1.0,
      taggedById: 1,
      taggedByName: '王小美',
      observedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      note: 'Threads 爆款發酵中',
    },
    {
      id: 2,
      keywordId: 201,
      keywordText: '韓系保暖手套',
      sourceUrl: 'https://www.xiaohongshu.com/explore/67890',
      platform: 'XIAOHONGSHU',
      heatLevel: 4,
      currentWeight: 0.5,
      taggedById: 2,
      taggedByName: '陳大明',
      observedAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(),
      note: '小紅書穿搭博主推薦',
    },
    {
      id: 3,
      productId: 102,
      productName: '便攜式筋膜槍',
      sourceUrl: 'https://www.tiktok.com/@sports/video/111',
      platform: 'TIKTOK',
      heatLevel: 3,
      currentWeight: 0.0,
      taggedById: 1,
      taggedByName: '王小美',
      observedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
      note: '已過期標記',
    },
  ];

  beforeEach(async () => {
    mockHeatTagService = {
      list1: vi.fn().mockReturnValue(of({ success: true, data: sampleTags })),
      resolvePlatform: vi.fn().mockReturnValue(of({ success: true, data: { platform: 'THREADS' } })),
      create1: vi.fn().mockReturnValue(of({ success: true, data: sampleTags[0] })),
      update1: vi.fn().mockReturnValue(of({ success: true, data: sampleTags[0] })),
      delete1: vi.fn().mockReturnValue(of({ success: true })),
    };

    mockProductService = {
      search: vi.fn().mockReturnValue(of({
        success: true,
        data: {
          content: [
            { id: 101, name: '石墨烯智能溫控眼罩', categoryName: '生活家電', trackType: 'A' },
          ],
        },
      })),
    };

    mockReferenceService = {
      getTrendKeywords: vi.fn().mockReturnValue(of({
        success: true,
        data: [
          { id: 201, keyword: '韓系保暖手套' },
        ],
      })),
    };

    mockCurrentUser = signal<any>({ id: '1', name: '王小美', roles: ['BUYER'] });
    mockAuthService = {
      currentUser: mockCurrentUser,
      hasRole: vi.fn().mockImplementation((roles: string[]) => {
        const user = mockCurrentUser();
        return user?.roles?.some((r: string) => roles.includes(r)) ?? false;
      }),
    };

    mockSnackBar = {
      open: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [HeatTagsComponent],
      providers: [
        provideAnimationsAsync(),
        { provide: ManualHeatTagControllerService, useValue: mockHeatTagService },
        { provide: ProductControllerService, useValue: mockProductService },
        { provide: ProductReferenceControllerService, useValue: mockReferenceService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HeatTagsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  describe('Regression checks', () => {
    it('preserves the original observation instant when editing only the note', () => {
      vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
      const tag = { ...sampleTags[0], observedAt: '2026-09-01T04:34:56.789Z' };
      component.startEdit(tag);
      component.note.set('只改備註');
      component.submitTag();
      expect(mockHeatTagService.update1).toHaveBeenCalledWith(expect.objectContaining({
        manualHeatTagUpdateRequest: expect.objectContaining({ observedAt: tag.observedAt })
      }), 'body', false, expect.anything());
    });

    it('does not apply a previous account’s pending submission response to the new account', () => {
      const response = new Subject<any>();
      mockHeatTagService.create1.mockReturnValue(response);
      component.onUrlChange('https://www.threads.net/p/1');
      component.selectPlatform('THREADS');
      component.selectTarget({ type: 'PRODUCT', id: 101, title: '品項' });
      component.submitTag();
      expect(component.isSubmitting()).toBe(true);
      mockCurrentUser.set({ id: '2', name: '陳大明', roles: ['BUYER'] });
      fixture.detectChanges();
      response.next({ data: sampleTags[0] });
      expect(component.isSubmitting()).toBe(false);
      expect(mockSnackBar.open).not.toHaveBeenCalled();
    });

    it('blocks submission during platform debounce and failed resolution until manually selected', async () => {
      vi.useFakeTimers();
      mockHeatTagService.resolvePlatform.mockReturnValue(throwError(() => ({ status: 0 })));
      component.onUrlChange('https://www.tiktok.com/video/1');
      component.selectTarget({ type: 'KEYWORD', id: 201, title: '手套' });
      component.submitTag();
      expect(mockHeatTagService.create1).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(450);
      expect(component.platformError()).toContain('手動');
      expect(component.isFormValid()).toBe(false);
      component.selectPlatform('TIKTOK');
      expect(component.isFormValid()).toBe(true);
    });

    it('ignores old platform responses as soon as the URL changes', async () => {
      vi.useFakeTimers();
      const oldResponse = new Subject<any>();
      mockHeatTagService.resolvePlatform.mockReturnValueOnce(oldResponse).mockReturnValueOnce(of({ data: { platform: 'INSTAGRAM' } }));
      component.onUrlChange('https://www.tiktok.com/video/1');
      await vi.advanceTimersByTimeAsync(450);
      component.onUrlChange('https://www.instagram.com/p/2');
      oldResponse.next({ data: { platform: 'TIKTOK' } });
      expect(component.platform()).toBe('OTHER');
      await vi.advanceTimersByTimeAsync(450);
      expect(component.platform()).toBe('INSTAGRAM');
    });

    it('keeps the manual platform label after a delayed automatic response', async () => {
      vi.useFakeTimers();
      const response = new Subject<any>();
      mockHeatTagService.resolvePlatform.mockReturnValue(response);
      component.onUrlChange('https://www.tiktok.com/video/1');
      await vi.advanceTimersByTimeAsync(450);
      component.selectPlatform('FACEBOOK');
      response.next({ data: { platform: 'TIKTOK' } });
      expect(component.platform()).toBe('FACEBOOK');
      expect(component.platformResolvedLabel()).toContain('手動指定');
    });

    it('does not allow a same-name user to modify someone else’s tag', () => {
      expect(component.canModifyTag({ ...sampleTags[1], taggedByName: '王小美' })).toBe(false);
      mockCurrentUser.set({ id: '1', name: '王小美', roles: ['VIEWER'] });
      expect(component.canWrite()).toBe(false);
      expect(component.canModifyTag(sampleTags[0])).toBe(false);
    });

    it('clears the edit form and reloads tags when the logged-in account changes', () => {
      vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
      component.startEdit(sampleTags[0]);
      mockHeatTagService.list1.mockReturnValue(of({ data: [sampleTags[1]] }));
      mockCurrentUser.set({ id: '2', name: '陳大明', roles: ['DATA_ADMIN'] });
      fixture.detectChanges();
      expect(component.editingTagId()).toBeNull();
      expect(component.sourceUrl()).toBe('');
      expect(component.currentUser()?.name).toBe('陳大明');
      expect(component.tags()).toEqual([sampleTags[1]]);
    });

    it('validates URLs, field limits and observation time before calling the API', () => {
      component.selectTarget({ type: 'PRODUCT', id: 101, title: '品項' });
      component.onUrlChange('javascript:alert(1)');
      component.selectPlatform('OTHER');
      expect(component.urlError()).toBeTruthy();
      expect(component.isFormValid()).toBe(false);
      component.onUrlChange('https://www.threads.net/p/1');
      component.selectPlatform('THREADS');
      component.note.set('字'.repeat(256));
      expect(component.isFormValid()).toBe(false);
      component.note.set('');
      component.observedAt.set('invalid');
      component.submitTag();
      expect(mockHeatTagService.create1).not.toHaveBeenCalled();
      expect(component.isSubmitting()).toBe(false);
    });

    it('sends the user-edited local observation time as UTC', () => {
      component.onUrlChange('https://www.threads.net/p/1');
      component.selectPlatform('THREADS');
      component.selectTarget({ type: 'PRODUCT', id: 101, title: '品項' });
      component.observedAt.set('2026-09-01T12:34:56');
      component.submitTag();
      expect(mockHeatTagService.create1).toHaveBeenCalledWith(expect.objectContaining({
        manualHeatTagCreateRequest: expect.objectContaining({ observedAt: new Date('2026-09-01T12:34:56').toISOString() })
      }), 'body', false, expect.anything());
    });

    it('distinguishes a list failure from an empty list and shows the backend message', () => {
      mockHeatTagService.list1.mockReturnValue(throwError(() => ({ error: { error: { message: '服務暫時不可用' } } })));
      component.loadTags();
      fixture.detectChanges();
      expect(component.listError()).toBe('服務暫時不可用');
      expect(fixture.nativeElement.textContent).toContain('載入失敗：服務暫時不可用');
      expect(fixture.nativeElement.textContent).not.toContain('此觀察視窗內沒有人工');
    });

    it('does not display the previous scope after switching while a request is pending', () => {
      const oldResponse = new Subject<any>();
      mockHeatTagService.list1.mockReturnValueOnce(oldResponse).mockReturnValueOnce(of({ data: [sampleTags[0]] }));
      component.loadTags();
      component.switchScope('MINE');
      oldResponse.next({ data: sampleTags });
      expect(component.tags()).toEqual([sampleTags[0]]);
    });

    it('searches products even when the keyword service fails', async () => {
      vi.useFakeTimers();
      mockReferenceService.getTrendKeywords.mockReturnValue(throwError(() => ({ status: 0 })));
      component.onSearchInput('手套');
      await vi.advanceTimersByTimeAsync(350);
      expect(mockProductService.search).toHaveBeenCalled();
      expect(component.searchResults().map(item => item.type)).toEqual(['PRODUCT']);
      expect(component.searchError()).toContain('關鍵字搜尋失敗');
    });

    it('cancels stale searches immediately and allows retrying the same query', async () => {
      vi.useFakeTimers();
      const oldResponse = new Subject<any>();
      mockProductService.search.mockReturnValueOnce(oldResponse);
      component.onSearchInput('舊品項');
      await vi.advanceTimersByTimeAsync(350);
      component.onSearchInput('新品項');
      oldResponse.next({ data: { content: [{ id: 99, name: '舊品項' }] } });
      oldResponse.complete();
      expect(component.searchResults()).toEqual([]);
      await vi.advanceTimersByTimeAsync(350);
      component.onSearchInput('新品項');
      await vi.advanceTimersByTimeAsync(350);
      expect(mockProductService.search).toHaveBeenCalledTimes(3);
    });

    it('loads the next product page without losing keyword results', async () => {
      vi.useFakeTimers();
      mockProductService.search.mockReturnValueOnce(of({ data: { content: [{ id: 101, name: '第一筆', trackType: 'B' }], totalPages: 2 } }))
        .mockReturnValueOnce(of({ data: { content: [{ id: 102, name: '第二筆' }], totalPages: 2 } }));
      component.onSearchInput('手套');
      await vi.advanceTimersByTimeAsync(350);
      expect(component.hasMoreProducts()).toBe(true);
      component.loadMoreProducts();
      expect(mockProductService.search).toHaveBeenLastCalledWith({ keyword: '手套', size: 20, page: 1 }, 'body', false, expect.anything());
      expect(component.searchResults().map(item => item.id)).toEqual([201, 101, 102]);
      expect(component.hasMoreProducts()).toBe(false);
    });
  });

  it('should create and load initial tags list', () => {
    expect(component).toBeTruthy();
    expect(mockHeatTagService.list1).toHaveBeenCalledWith(
      { scope: 'ALL', days: 30 },
      'body',
      false,
      expect.objectContaining({ httpHeaderAccept: 'application/json' })
    );
    expect(component.tags().length).toBe(3);
    // 只有 2 天前的 tag1 在近 7 天內
    expect(component.weeklyCount()).toBe(1);
  });

  describe('URL platform auto-resolution and manual override (AC-14-1)', () => {
    it('should trigger resolvePlatform and set detected platform when typing a valid URL', async () => {
      vi.useFakeTimers();
      mockHeatTagService.resolvePlatform.mockReturnValue(
        of({ success: true, data: { platform: 'TIKTOK' } })
      );

      component.onUrlChange('https://www.tiktok.com/@trendy/video/12345');
      expect(component.sourceUrl()).toBe('https://www.tiktok.com/@trendy/video/12345');

      await vi.advanceTimersByTimeAsync(450);

      expect(mockHeatTagService.resolvePlatform).toHaveBeenCalledWith(
        { resolvePlatformRequest: { sourceUrl: 'https://www.tiktok.com/@trendy/video/12345' } },
        'body',
        false,
        expect.objectContaining({ httpHeaderAccept: 'application/json' })
      );
      expect(component.platform()).toBe('TIKTOK');
      expect(component.platformResolvedLabel()).toContain('TikTok');
    });

    it('should allow user to manually override platform and not let auto-resolve overwrite it', async () => {
      vi.useFakeTimers();

      // 模擬 URL 辨識回傳 THREADS
      mockHeatTagService.resolvePlatform.mockReturnValue(
        of({ success: true, data: { platform: 'THREADS' } })
      );

      // 使用者先輸入 URL
      component.onUrlChange('https://www.threads.net/@someone/post/999');

      // 使用者手動指定小紅書覆蓋
      component.selectPlatform('XIAOHONGSHU');
      expect(component.platform()).toBe('XIAOHONGSHU');
      expect(component.isPlatformManuallyOverridden()).toBe(true);
      expect(component.platformResolvedLabel()).toContain('手動指定');

      // 經過 debounce 觸發非同步辨識回傳
      await vi.advanceTimersByTimeAsync(450);

      // 因為已手動指定，平台維持 XIAOHONGSHU
      expect(component.platform()).toBe('XIAOHONGSHU');
    });

    it('should clear platformResolvedLabel if url is empty or invalid', async () => {
      vi.useFakeTimers();
      component.onUrlChange('');
      await vi.advanceTimersByTimeAsync(450);
      expect(component.platformResolvedLabel()).toBe('');
      expect(mockHeatTagService.resolvePlatform).not.toHaveBeenCalled();
    });
  });

  describe('Target selection (Product / Keyword)', () => {
    it('should search keywords and products when query entered', async () => {
      vi.useFakeTimers();
      component.onSearchInput('手套');
      expect(component.searchQuery()).toBe('手套');
      expect(component.isSearchOpen()).toBe(true);

      await vi.advanceTimersByTimeAsync(350);

      expect(mockReferenceService.getTrendKeywords).toHaveBeenCalledWith(
        { keyword: '手套', enabled: true },
        'body',
        false,
        expect.objectContaining({ httpHeaderAccept: 'application/json' })
      );
      expect(mockProductService.search).toHaveBeenCalledWith(
        { keyword: '手套', size: 20, page: 0 },
        'body',
        false,
        expect.objectContaining({ httpHeaderAccept: 'application/json' })
      );
      expect(component.searchResults().length).toBe(2);
      expect(component.searchResults()[0].title).toBe('韓系保暖手套');
      expect(component.searchResults()[1].title).toBe('石墨烯智能溫控眼罩');
    });

    it('should select a keyword target and clear search input', () => {
      component.selectTarget({
        type: 'KEYWORD',
        id: 201,
        title: '韓系保暖手套',
      });

      expect(component.selectedKeyword()).toEqual({ id: 201, keyword: '韓系保暖手套' });
      expect(component.selectedProduct()).toBeNull();
      expect(component.isSearchOpen()).toBe(false);
      expect(component.searchQuery()).toBe('');
    });

    it('should select a product target and clear search input', () => {
      component.selectTarget({
        type: 'PRODUCT',
        id: 101,
        title: '石墨烯智能溫控眼罩',
        track: 'A',
      });

      expect(component.selectedProduct()).toEqual({ id: 101, name: '石墨烯智能溫控眼罩', track: 'A' });
      expect(component.selectedKeyword()).toBeNull();
    });

    it('should clear selected target', () => {
      component.selectTarget({ type: 'KEYWORD', id: 201, title: '韓系保暖手套' });
      component.clearSelectedTarget();
      expect(component.selectedProduct()).toBeNull();
      expect(component.selectedKeyword()).toBeNull();
    });

    it('should close search panel when user clicks outside the search wrapper', () => {
      component.isSearchOpen.set(true);
      expect(component.isSearchOpen()).toBe(true);

      // 模擬點擊外部元素
      const outsideDiv = document.createElement('div');
      document.body.appendChild(outsideDiv);
      component.onDocumentClick(new MouseEvent('click', { bubbles: true }));

      expect(component.isSearchOpen()).toBe(false);
      document.body.removeChild(outsideDiv);
    });

    it('should close search panel when focus leaves the wrapper', () => {
      component.isSearchOpen.set(true);
      expect(component.isSearchOpen()).toBe(true);

      const outsideButton = document.createElement('button');
      component.onSearchFocusOut({ relatedTarget: outsideButton } as any);

      expect(component.isSearchOpen()).toBe(false);
    });
  });

  describe('Form validation and tag submission', () => {
    it('should validate form correctly', () => {
      expect(component.isFormValid()).toBe(false);

      component.onUrlChange('https://www.threads.net/@user/post/1');
      expect(component.isFormValid()).toBe(false);

      component.selectTarget({ type: 'PRODUCT', id: 101, title: '石墨烯智能溫控眼罩' });
      expect(component.isFormValid()).toBe(false);
      component.selectPlatform('THREADS');
      expect(component.isFormValid()).toBe(true);
    });

    it('should submit a new tag with product target and refresh list', () => {
      component.onUrlChange('https://www.threads.net/@user/post/12345');
      component.selectPlatform('THREADS');
      component.selectHeatLevel(5);
      component.selectTarget({ type: 'PRODUCT', id: 101, title: '石墨烯智能溫控眼罩' });
      component.note.set('社群爆款測試');

      component.submitTag();

      expect(mockHeatTagService.create1).toHaveBeenCalledWith(
        expect.objectContaining({
          manualHeatTagCreateRequest: expect.objectContaining({
            sourceUrl: 'https://www.threads.net/@user/post/12345',
            platform: 'THREADS',
            heatLevel: 5,
            productId: 101,
            keywordId: undefined,
            note: '社群爆款測試',
          }),
        }),
        'body',
        false,
        expect.objectContaining({ httpHeaderAccept: 'application/json' })
      );
      expect(mockSnackBar.open).toHaveBeenCalledWith('人工熱度標記建立成功！', '關閉', { duration: 3000 });
      // 應清空表單
      expect(component.sourceUrl()).toBe('');
      expect(component.selectedProduct()).toBeNull();
      // 應重新載入清單
      expect(mockHeatTagService.list1).toHaveBeenCalledTimes(2);
    });

    it('should submit a new tag with keyword target', () => {
      component.onUrlChange('https://www.xiaohongshu.com/explore/67890');
      component.selectPlatform('XIAOHONGSHU');
      component.selectHeatLevel(4);
      component.selectTarget({ type: 'KEYWORD', id: 201, title: '韓系保暖手套' });

      component.submitTag();

      expect(mockHeatTagService.create1).toHaveBeenCalledWith(
        expect.objectContaining({
          manualHeatTagCreateRequest: expect.objectContaining({
            keywordId: 201,
            productId: undefined,
            platform: 'XIAOHONGSHU',
            heatLevel: 4,
          }),
        }),
        'body',
        false,
        expect.anything()
      );
    });

    it('should handle creation error and show snackbar error message', () => {
      mockHeatTagService.create1.mockReturnValue(
        throwError(() => ({ error: { message: '後端驗證失敗' } }))
      );

      component.onUrlChange('https://www.threads.net/@user/post/1');
      component.selectTarget({ type: 'PRODUCT', id: 101, title: '品項' });
      component.selectPlatform('THREADS');

      component.submitTag();

      expect(component.isSubmitting()).toBe(false);
      expect(mockSnackBar.open).toHaveBeenCalledWith('標記失敗: 後端驗證失敗', '關閉', { duration: 4000 });
    });
  });

  describe('Scope switching', () => {
    it('should switch scope and reload tags', () => {
      expect(component.scope()).toBe('ALL');
      component.switchScope('MINE');
      expect(component.scope()).toBe('MINE');

      expect(mockHeatTagService.list1).toHaveBeenCalledWith(
        { scope: 'MINE', days: 30 },
        'body',
        false,
        expect.anything()
      );
    });
  });

  describe('Editing existing tags', () => {
    it('should populate form when startEdit is called and scroll up', () => {
      const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
      const tagToEdit = sampleTags[0];

      component.startEdit(tagToEdit);

      expect(component.editingTagId()).toBe(1);
      expect(component.sourceUrl()).toBe(tagToEdit.sourceUrl);
      expect(component.platform()).toBe(tagToEdit.platform);
      expect(component.heatLevel()).toBe(tagToEdit.heatLevel);
      expect(component.selectedProduct()?.id).toBe(101);
      expect(scrollSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    });

    it('should submit update when in edit mode', () => {
      component.startEdit(sampleTags[0]);
      component.selectHeatLevel(3);
      component.note.set('修改備註內容');

      component.submitTag();

      expect(mockHeatTagService.update1).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          manualHeatTagUpdateRequest: expect.objectContaining({
            heatLevel: 3,
            note: '修改備註內容',
          }),
        }),
        'body',
        false,
        expect.anything()
      );
      expect(mockSnackBar.open).toHaveBeenCalledWith('標記更新成功', '關閉', { duration: 3000 });
      expect(component.editingTagId()).toBeNull();
    });

    it('should cancel edit mode', () => {
      component.startEdit(sampleTags[0]);
      expect(component.editingTagId()).toBe(1);

      component.cancelEdit();

      expect(component.editingTagId()).toBeNull();
      expect(component.sourceUrl()).toBe('');
      expect(component.selectedProduct()).toBeNull();
    });
  });

  describe('Deleting tags', () => {
    it('should delete tag when confirmed and reload list', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      component.deleteTag(sampleTags[0]);

      expect(mockHeatTagService.delete1).toHaveBeenCalledWith(
        { id: 1 },
        'body',
        false,
        expect.anything()
      );
      expect(mockSnackBar.open).toHaveBeenCalledWith('標記已刪除', '關閉', { duration: 2500 });
      expect(mockHeatTagService.list1).toHaveBeenCalledTimes(2);
    });

    it('should not delete tag when cancelled by user', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      component.deleteTag(sampleTags[0]);

      expect(mockHeatTagService.delete1).not.toHaveBeenCalled();
    });
  });

  describe('Display and formatting helpers', () => {
    it('should format relative times correctly', () => {
      const now = new Date();
      expect(component.formatRelativeTime(now.toISOString())).toBe('今天');

      const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
      expect(component.formatRelativeTime(yesterday.toISOString())).toBe('昨天');

      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      expect(component.formatRelativeTime(fiveDaysAgo.toISOString())).toBe('5 天前');

      const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      expect(component.formatRelativeTime(fortyDaysAgo.toISOString())).toContain('(已失效)');
    });

    it('should map weight display and css class according to AC-14-2', () => {
      expect(component.getWeightDisplay(1.0)).toEqual({ text: '100%', cssClass: 'status-badge compact status-normal' });
      expect(component.getWeightDisplay(0.5)).toEqual({ text: '50%', cssClass: 'status-badge compact status-quota' });
      expect(component.getWeightDisplay(0.0)).toEqual({ text: '已失效', cssClass: 'status-badge compact override-badge' });
      expect(component.getWeightDisplay(undefined)).toEqual({ text: '-', cssClass: '' });
    });

    it('should check canModifyTag permissions correctly', () => {
      // 本人建立
      expect(component.canModifyTag(sampleTags[0])).toBe(true);

      // 他人建立，非管理員
      expect(component.canModifyTag(sampleTags[1])).toBe(false);

      // 他人建立，但是管理者
      mockCurrentUser.set({ id: '1', name: '王小美', roles: ['SYS_ADMIN'] });
      expect(component.canModifyTag(sampleTags[1])).toBe(true);
    });

    it('should map platform labels and css classes correctly', () => {
      expect(component.getPlatformLabel('THREADS')).toBe('Threads');
      expect(component.getPlatformLabel('TIKTOK')).toBe('TikTok');
      expect(component.getPlatformLabel('XIAOHONGSHU')).toBe('小紅書');
      expect(component.getPlatformLabel('UNKNOWN')).toBe('UNKNOWN');

      expect(component.getPlatformClass('THREADS')).toBe('plat-threads');
      expect(component.getPlatformClass('TIKTOK')).toBe('plat-tiktok');
      expect(component.getPlatformClass('XIAOHONGSHU')).toBe('plat-red');
      expect(component.getPlatformClass('INSTAGRAM')).toBe('plat-ig');
      expect(component.getPlatformClass('FACEBOOK')).toBe('plat-fb');
      expect(component.getPlatformClass('OTHER')).toBe('plat-other');
    });
  });
});
