import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { LoginComponent } from './login.component';
import { HttpErrorResponse } from '@angular/common/http';
import { MOCK_ACCOUNTS } from '../../../core/auth/mock-users';

describe('LoginComponent', () => {
  const login = vi.fn();
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let router: Router;

  beforeEach(async () => {
    login.mockReset();
    login.mockReturnValue(
      of({
        accessToken: 'jwt-token',
        email: 'buyer@ssds.dev',
        displayName: 'Buyer',
        roles: ['BUYER'],
      }),
    );

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            login,
            getMockAccounts: () => [
              { email: 'buyer@ssds.dev', password: 'password', role: 'BUYER', name: '採購人員' },
            ],
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => {
    component.ngOnDestroy();
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('logs in through the backend and navigates to returnUrl or dashboard', () => {
    const navigate = vi.spyOn(router, 'navigateByUrl');
    component.email = 'buyer@ssds.dev';
    component.password = 'secret';

    component.onLogin();

    expect(login).toHaveBeenCalledWith({ email: 'buyer@ssds.dev', password: 'secret' });
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('handles feature card expansion and sub-features filtering', () => {
    expect(component.activeFeatureIdx).toBeNull();
    expect(component.activeFeature).toBeNull();
    expect(component.otherFeatures).toEqual([]);

    component.selectFeature(0);
    expect(component.activeFeatureIdx).toBe(0);
    expect(component.activeFeature?.title).toBe('四大情境分榜');
    expect(component.otherFeatures.length).toBe(3);
    expect(component.otherFeatures.map((f) => f.id)).toEqual([1, 2, 3]);

    component.onEscape();
    expect(component.activeFeatureIdx).toBeNull();
  });

  it('closes expanded feature card on document click outside', () => {
    component.selectFeature(1);
    expect(component.activeFeatureIdx).toBe(1);

    const outsideElement = document.createElement('div');
    component.onDocumentClick({ target: outsideElement } as unknown as MouseEvent);
    expect(component.activeFeatureIdx).toBeNull();
  });

  it('toggles password visibility', () => {
    expect(component.showPassword).toBe(false);
    component.togglePasswordVisibility();
    expect(component.showPassword).toBe(true);
    component.togglePasswordVisibility();
    expect(component.showPassword).toBe(false);
  });

  it('keeps details open when clicking inside and switches between capabilities', async () => {
    fixture.nativeElement.querySelector('[data-feature-id="1"]').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const sheet = fixture.nativeElement.querySelector('.feature-sheet');
    sheet.click();
    expect(component.activeFeatureIdx).toBe(1);
    const switches = fixture.nativeElement.querySelectorAll('.feature-switch');
    expect(switches.length).toBe(3);
    switches[0].click();
    fixture.detectChanges();
    expect(component.activeFeatureIdx).toBe(0);
    expect(fixture.nativeElement.querySelector('.feature-tab').textContent).toContain(
      '四大情境分榜',
    );
  });

  it('closes details on outside click without moving focus from the email input', async () => {
    component.selectFeature(1);
    fixture.detectChanges();
    await fixture.whenStable();
    const emailInput = fixture.nativeElement.querySelector('#email');
    emailInput.focus();
    emailInput.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.activeFeatureIdx).toBeNull();
    expect(document.activeElement).toBe(emailInput);
  });

  it('returns focus to the selected capability after Escape', async () => {
    fixture.nativeElement.querySelector('[data-feature-id="2"]').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.feature-close'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('[data-feature-id="2"]'),
    );
  });

  it('fills mock account details correctly', () => {
    component.fillMockAccount(MOCK_ACCOUNTS[0]);
    expect(component.email).toBe(MOCK_ACCOUNTS[0].email);
    expect(component.password).toBe(MOCK_ACCOUNTS[0].password);
    expect(component.errorMessage).toBe('');
  });

  it('advances slogan rotation', () => {
    expect(component.slogans.length).toBe(4);
    expect(component.currentSloganIdx).toBe(0);
    expect(component.slogans[0]).toBe('社群爆款');
  });

  it('displays error message when login fails', () => {
    login.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({ status: 401, error: { error: { message: '帳號或密碼錯誤' } } }),
      ),
    );

    component.email = 'wrong@ssds.dev';
    component.password = 'wrongpwd';
    component.onLogin();

    expect(component.isLoading).toBe(false);
    expect(component.errorMessage).toBe('帳號或密碼錯誤');
  });

  it('navigates to forget password page', () => {
    const navigate = vi.spyOn(router, 'navigate');
    component.forget();
    expect(navigate).toHaveBeenCalledWith(['/forget-password']);
  });

  it('submits once when clicking the submit button', async () => {
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    component.email = 'buyer@ssds.dev';
    component.password = 'secret';
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.nativeElement.querySelector('button[type="submit"]').click();
    expect(login).toHaveBeenCalledTimes(1);
  });

  it('ignores repeated submissions while authentication is pending', () => {
    const response = new Subject<any>();
    login.mockReturnValue(response);
    component.email = 'buyer@ssds.dev';
    component.password = 'secret';
    component.onLogin();
    component.onLogin();
    expect(login).toHaveBeenCalledTimes(1);
    response.error(new HttpErrorResponse({ status: 401 }));
    expect(component.isLoading).toBe(false);
  });

  it('stops slogan playback when destroyed', () => {
    component.stopSloganTimer();
    vi.useFakeTimers();
    component.startSloganTimer();
    component.ngOnDestroy();
    vi.advanceTimersByTime(2000);
    expect(component.currentSloganIdx).toBe(0);
  });

  it('continuously rotates through all slogans and wraps to the first', () => {
    component.stopSloganTimer();
    vi.useFakeTimers();
    component.startSloganTimer();
    vi.advanceTimersByTime(1000);
    expect(component.currentSloganIdx).toBe(1);
    vi.advanceTimersByTime(3000);
    expect(component.currentSloganIdx).toBe(0);
  });
});
