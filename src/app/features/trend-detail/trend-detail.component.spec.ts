import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrendDetailComponent } from './trend-detail.component';

describe('TrendDetailComponent', () => {
  let component: TrendDetailComponent;
  let fixture: ComponentFixture<TrendDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrendDetailComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TrendDetailComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
