import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { BasicAuthService } from '../../core/auth/basic-auth.service';
import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  const clearCredentials = vi.fn();
  const navigate = vi.fn();
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    clearCredentials.mockReset();
    navigate.mockReset();
    navigate.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        {
          provide: BasicAuthService,
          useValue: { clearCredentials },
        },
        {
          provide: Router,
          useValue: { navigate },
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

  it('clears Basic Auth credentials and returns to login', () => {
    component.logout();

    expect(clearCredentials).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
