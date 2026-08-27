import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { BasicAuthService } from '../../../core/auth/basic-auth.service';
import { ProductService } from '../../products/product.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  const setCredentials = vi.fn();
  const clearCredentials = vi.fn();
  const load = vi.fn();
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let router: Router;

  beforeEach(async () => {
    setCredentials.mockReset();
    clearCredentials.mockReset();
    load.mockReset();
    load.mockReturnValue(of({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        {
          provide: BasicAuthService,
          useValue: { setCredentials, clearCredentials },
        },
        {
          provide: ProductService,
          useValue: { load, error: () => null },
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

  it('sets Basic credentials, verifies them, and navigates to products', () => {
    const navigate = vi.spyOn(router, 'navigateByUrl');
    component.form.controls.password.setValue('secret');

    component.submit();

    expect(setCredentials).toHaveBeenCalledWith('buyer@ssds.dev', 'secret');
    expect(load).toHaveBeenCalledWith({ page: 0, size: 20 });
    expect(navigate).toHaveBeenCalledWith('/products');
  });
});
