import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GradeChipComponent } from './grade-chip.component';

describe('GradeChipComponent', () => {
  let component: GradeChipComponent;
  let fixture: ComponentFixture<GradeChipComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GradeChipComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GradeChipComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
