import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SourcingComponent } from './sourcing.component';

describe('SourcingComponent', () => {
  let component: SourcingComponent;
  let fixture: ComponentFixture<SourcingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SourcingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SourcingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
