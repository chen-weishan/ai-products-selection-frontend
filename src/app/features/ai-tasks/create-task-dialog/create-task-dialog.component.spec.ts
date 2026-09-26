import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreateTaskDialogComponent } from './create-task-dialog.component';
import { MatDialogRef } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('CreateTaskDialogComponent', () => {
  let component: CreateTaskDialogComponent;
  let fixture: ComponentFixture<CreateTaskDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockDialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CreateTaskDialogComponent],
      providers: [
        provideAnimationsAsync(),
        { provide: MatDialogRef, useValue: mockDialogRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateTaskDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should parse product IDs correctly from varied string formats', () => {
    expect(component.parseProductIds('101, 102 103\n104,105')).toEqual([101, 102, 103, 104, 105]);
    expect(component.parseProductIds('abc, -5, 0, 42')).toEqual([42]);
    expect(component.parseProductIds('10, 10, 20')).toEqual([10, 20]);
  });

  it('should close dialog with payload on submit', () => {
    component.form.controls.productIdsInput.setValue('101, 102');
    component.form.controls.forceRefresh.setValue(true);
    expect(component.isValid).toBe(true);

    component.onSubmit();
    expect(mockDialogRef.close).toHaveBeenCalledWith({
      taskType: 'FULL_ANALYSIS',
      productIds: [101, 102],
      forceRefresh: true,
    });
  });

  it('should close with null on cancel', () => {
    component.onCancel();
    expect(mockDialogRef.close).toHaveBeenCalledWith(null);
  });
});
