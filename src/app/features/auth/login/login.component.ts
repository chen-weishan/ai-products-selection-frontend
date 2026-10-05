import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ElementRef,
  Injector,
  ViewChild,
  afterNextRender,
  inject,
} from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';
import { MockAccount } from '../../../core/auth/mock-users';
import { HttpErrorResponse } from '@angular/common/http';

export interface CapabilityFeature {
  id: number;
  title: string;
  icon: string;
  hook: string;
  detail: string;
}

@Component({
  selector: 'app-login',
  imports: [FormsModule, MatIcon],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit, OnDestroy {
  private authservice = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private element: ElementRef<HTMLElement> = inject(ElementRef);
  private injector = inject(Injector);
  @ViewChild('featureContainer') private featureContainer?: ElementRef<HTMLElement>;

  private readonly REMEMBERED_EMAIL_KEY = 'ssds_remembered_email';

  email = '';
  password = '';
  showPassword = false;
  rememberMe = false;
  isLoading = false;
  errorMessage = '';
  fieldErrors: Record<string, string> = {};

  /** 模擬帳號列表供快速填入測試 */
  readonly mockAccounts = this.authservice.getMockAccounts();

  /** 3D 曜石黑輪播標語 (4 字定寬無抖動) */
  readonly slogans = ['社群爆款', '節慶商機', '熱銷潛力', '長銷經典'];
  currentSloganIdx = 0;
  private sloganTimer: ReturnType<typeof setInterval> | null = null;

  /** 四大核心能力結構化資料 */
  readonly featureData: CapabilityFeature[] = [
    {
      id: 0,
      title: '四大情境分榜',
      icon: 'layers',
      hook: '不同選品情境，各有值得關注的機會。',
      detail:
        '依社群爆款、節慶商機、熱銷潛力與長銷經典整理商品，讓團隊從不同市場角度，找到適合探索的選品方向。',
    },
    {
      id: 1,
      title: '14 天熱度衰減',
      icon: 'history',
      hook: '觀察熱度變化，讓決策跟上市場節奏。',
      detail:
        '透過熱度衰減機制，讓近期訊號獲得較高權重。結合趨勢變化與歷史表現，協助判斷商品的熱度是否仍值得關注。',
    },
    {
      id: 2,
      title: 'AI 賣點提煉',
      icon: 'auto_awesome',
      hook: '從商品資訊，提煉清晰的選品理由。',
      detail:
        '以 AI 整理商品特性、受眾需求與相關資訊，提煉核心賣點及差異化方向，為採購討論與行銷規劃提供切入點。',
    },
    {
      id: 3,
      title: '真實回測審批',
      icon: 'verified_user',
      hook: '用資料檢驗想法，讓團隊共同把關。',
      detail:
        '結合歷史回測與團隊審批流程，檢視選品依據、紀錄評估結果，讓每一次決策都有可追溯的討論與驗證過程。',
    },
  ];

  activeFeatureIdx: number | null = null;

  get activeFeature(): CapabilityFeature | null {
    return this.activeFeatureIdx !== null ? this.featureData[this.activeFeatureIdx] : null;
  }

  get otherFeatures(): CapabilityFeature[] {
    return this.activeFeatureIdx !== null
      ? this.featureData.filter((f) => f.id !== this.activeFeatureIdx)
      : [];
  }

  ngOnInit(): void {
    // 1. 還原「記住我」的電子郵件
    const savedEmail = localStorage.getItem(this.REMEMBERED_EMAIL_KEY);
    if (savedEmail) {
      this.email = savedEmail;
      this.rememberMe = true;
    }

    // 固定節奏切換；雙層文字的淡入淡出由 CSS 同步處理。
    this.startSloganTimer();
  }

  ngOnDestroy(): void {
    this.stopSloganTimer();
  }

  startSloganTimer(): void {
    this.stopSloganTimer();
    this.sloganTimer = setInterval(() => {
      this.nextSlogan();
    }, 1000);
  }

  stopSloganTimer(): void {
    if (this.sloganTimer) {
      clearInterval(this.sloganTimer);
      this.sloganTimer = null;
    }
  }

  nextSlogan(): void {
    this.currentSloganIdx = (this.currentSloganIdx + 1) % this.slogans.length;
  }

  selectFeature(idx: number | null, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const previousIdx = this.activeFeatureIdx;
    this.activeFeatureIdx = idx;
    afterNextRender(
      () => {
        if (this.activeFeatureIdx !== idx) return;
        const selector = idx !== null ? '.feature-close' : `[data-feature-id="${previousIdx}"]`;
        this.element.nativeElement.querySelector<HTMLButtonElement>(selector)?.focus();
      },
      { injector: this.injector },
    );
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.activeFeatureIdx !== null) {
      this.selectFeature(null);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target;
    if (
      this.activeFeatureIdx !== null &&
      target instanceof Node &&
      !this.featureContainer?.nativeElement.contains(target)
    ) {
      this.activeFeatureIdx = null;
    }
  }

  /** 快速填入指定角色的測試帳密 */
  fillMockAccount(account: MockAccount): void {
    this.email = account.email;
    this.password = account.password;
    this.errorMessage = '';
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onLogin(): void {
    if (this.isLoading) return;
    if (!this.email.trim() || !this.password.trim()) {
      this.errorMessage = '請輸入帳號或密碼';
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    this.fieldErrors = {};

    this.authservice.login({ email: this.email.trim(), password: this.password }).subscribe({
      next: () => {
        this.isLoading = false;

        // 處理記住我
        if (this.rememberMe) {
          localStorage.setItem(this.REMEMBERED_EMAIL_KEY, this.email.trim());
        } else {
          localStorage.removeItem(this.REMEMBERED_EMAIL_KEY);
        }

        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err: HttpErrorResponse | any) => {
        this.isLoading = false;
        this.handleLoginError(err);
        console.error('login failed', err);
      },
    });
  }

  private handleLoginError(err: HttpErrorResponse | any): void {
    // 1. 伺服器未啟動或無法連線 (status === 0)
    if (err instanceof HttpErrorResponse && err.status === 0) {
      this.errorMessage = '無法連線至後端伺服器，請確認伺服器是否已啟動 (8080 port)';
      return;
    }

    // 2. 嘗試解析後端自訂 API 錯誤結構 (err.error?.error)
    const backendError = err?.error?.error;
    if (backendError) {
      // 帳號鎖定 (AUTH_LOCKED)
      if (backendError.code === 'AUTH_LOCKED' || err?.status === 403) {
        this.errorMessage = backendError.message || '嘗試次數過多，帳號已被鎖定 15 分鐘';
        return;
      }
      // 登入驗證失敗 (AUTH_FAILED)
      if (backendError.code === 'AUTH_FAILED' || err?.status === 401) {
        this.errorMessage = backendError.message || '帳號或密碼錯誤';
        return;
      }
      if (backendError.message) {
        this.errorMessage = backendError.message;
        return;
      }
    }

    // 3. 嘗試解析標準 message
    if (err?.error?.message) {
      this.errorMessage = err.error.message;
      return;
    }

    // 4. 後端直接回傳字串時
    if (typeof err?.error === 'string' && err.error.trim()) {
      this.errorMessage = err.error;
      return;
    }

    // 5. 根據 HTTP 狀態碼提供友善訊息
    if (err?.status === 401) {
      this.errorMessage = '帳號或密碼錯誤';
    } else if (err?.status === 403) {
      this.errorMessage = '嘗試次數過多，帳號已被鎖定 15 分鐘';
    } else if (err?.status === 500) {
      if (!err?.error) {
        this.errorMessage =
          '後端連線失敗 (500 Proxy Error)，請確認 Spring Boot (8080 port) 是否已啟動';
      } else {
        this.errorMessage = '伺服器內部錯誤 (500)，請確認後端服務日誌';
      }
    } else {
      this.errorMessage = '登入失敗，請稍後再試';
    }
  }

  forget(): void {
    this.router.navigate(['/forget-password']);
  }
}
