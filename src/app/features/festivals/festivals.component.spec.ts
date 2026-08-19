import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FestivalsComponent } from './festivals.component';

describe('FestivalsComponent', () => {
  let component: FestivalsComponent;
  let fixture: ComponentFixture<FestivalsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FestivalsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FestivalsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
