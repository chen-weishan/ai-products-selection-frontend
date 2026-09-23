import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeatSourcesComponent } from './heat-sources.component';

describe('HeatSourcesComponent', () => {
  let component: HeatSourcesComponent;
  let fixture: ComponentFixture<HeatSourcesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeatSourcesComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HeatSourcesComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
