import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SourcingQueueComponent } from './sourcing-queue.component';

describe('SourcingQueueComponent', () => {
  let component: SourcingQueueComponent;
  let fixture: ComponentFixture<SourcingQueueComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SourcingQueueComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SourcingQueueComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
