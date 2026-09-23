import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrendDetailComponent } from './trend-detail.component';

import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('TrendDetailComponent', () => {
  let component: TrendDetailComponent;
  let fixture: ComponentFixture<TrendDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrendDetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TrendDetailComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
