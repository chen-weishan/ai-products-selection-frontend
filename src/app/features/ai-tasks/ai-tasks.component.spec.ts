import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiTasksComponent } from './ai-tasks.component';

describe('AiTasksComponent', () => {
  let component: AiTasksComponent;
  let fixture: ComponentFixture<AiTasksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiTasksComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AiTasksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
