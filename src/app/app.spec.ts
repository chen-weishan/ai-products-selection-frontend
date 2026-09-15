import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      // 根元件只放 router-outlet，沒有 Router 的 provider 會在渲染時 NG0201
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  /**
   * 根元件的樣板已改為 router-outlet，沒有 CLI 樣板留下的 h1 標題。
   * 這裡驗的是「畫面由路由決定」這件事本身。
   */
  it('should render the router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  /** 全域載入遮罩預設不顯示，只有 loadingInterceptor 有在途請求時才出現。 */
  it('should not show the loading overlay by default', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-loading')).toBeNull();
  });
});
