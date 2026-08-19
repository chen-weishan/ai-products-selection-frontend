import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeatTagsComponent } from './heat-tags.component';

describe('HeatTagsComponent', () => {
  let component: HeatTagsComponent;
  let fixture: ComponentFixture<HeatTagsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeatTagsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HeatTagsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
