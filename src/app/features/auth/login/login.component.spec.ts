import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { LoginComponent } from './login.component';

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
          useValue: { login, getMockAccounts: () => [] },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
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
});
