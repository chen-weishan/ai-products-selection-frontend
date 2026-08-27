import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProductService } from '../product.service';
import { ProductListComponent } from './product-list.component';

describe('ProductListComponent', () => {
  const load = vi.fn();
  let component: ProductListComponent;
  let fixture: ComponentFixture<ProductListComponent>;

  beforeEach(async () => {
    load.mockReset();
    load.mockReturnValue(of({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));

    await TestBed.configureTestingModule({
      imports: [ProductListComponent],
      providers: [
        {
          provide: ProductService,
          useValue: {
            load,
            products: signal([]),
            page: signal(0),
            totalElements: signal(0),
            loading: signal(false),
            error: signal(null),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads the first page on initialization', () => {
    expect(load).toHaveBeenCalledWith({ page: 0, size: 20 });
  });
});
