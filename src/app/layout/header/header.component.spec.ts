import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  const logout = vi.fn();
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    logout.mockReset();

    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        {
          provide: AuthService,
          useValue: { logout },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('logs out through the JWT auth service', () => {
    component.logout();

    expect(logout).toHaveBeenCalledOnce();
  });
});
