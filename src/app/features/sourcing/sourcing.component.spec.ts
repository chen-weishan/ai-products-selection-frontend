import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { SourcingComponent } from './sourcing.component';

describe('SourcingComponent', () => {
  let component: SourcingComponent;
  let fixture: ComponentFixture<SourcingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SourcingComponent],
      providers: [provideRouter([]), provideHttpClient()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(SourcingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses the backend capability when time gap is missing', () => {
    expect(component.canAddToSourcingQueue({
      timeGapDays: undefined,
      sourcingStatus: 'PENDING',
      canPrioritize: false,
    })).toBe(false);
  });

  it('rejects a negative gap even when a stale backend capability says it is allowed', () => {
    expect(component.canAddToSourcingQueue({
      timeGapDays: -1,
      sourcingStatus: 'PENDING',
      canPrioritize: true,
    })).toBe(false);
  });

  it('does not second-guess a stale or rejected response with a non-null gap', () => {
    expect(component.canAddToSourcingQueue({
      timeGapDays: 20,
      sourcingStatus: 'SOURCING',
      canPrioritize: false,
      prioritizeDisabledReason: '時效落差不是當日最新資料。',
    })).toBe(false);
    expect(component.canAddToSourcingQueue({
      timeGapDays: -1,
      sourcingStatus: 'REJECTED',
      canPrioritize: false,
    })).toBe(false);
  });

  it('allows a raw stranger result to be saved as watching', () => {
    expect(component.canSaveAsWatching({
      itemId: 731,
      productId: undefined,
      canWatch: true,
      canPrioritize: false,
    })).toBe(true);
  });

  it('disables both commands while an action is pending', () => {
    component.isActionPending.set(true);
    expect(component.canSaveAsWatching({ canWatch: true })).toBe(false);
    expect(component.canAddToSourcingQueue({ canPrioritize: true })).toBe(false);
  });
});
