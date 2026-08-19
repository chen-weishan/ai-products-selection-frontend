import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RiskDotComponent } from './risk-dot.component';

describe('RiskDotComponent', () => {
  let component: RiskDotComponent;
  let fixture: ComponentFixture<RiskDotComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RiskDotComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RiskDotComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
