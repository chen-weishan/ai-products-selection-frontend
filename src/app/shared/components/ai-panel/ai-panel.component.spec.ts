import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiPanelComponent } from './ai-panel.component';

describe('AiPanelComponent', () => {
  let component: AiPanelComponent;
  let fixture: ComponentFixture<AiPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiPanelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AiPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
