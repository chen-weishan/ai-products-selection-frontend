import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  ProductStatusDialogData,
  ProductStatusDialogResult,
} from '../../../core/models/product-status-dialog-model';

@Component({
  selector: 'app-product-status-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './product-status-dialog.html',
  styleUrl: './product-status-dialog.scss',
})
export class ProductStatusDialog {
  readonly dialogRef = inject(MatDialogRef<ProductStatusDialog, ProductStatusDialogResult | null>);
  readonly data = inject<ProductStatusDialogData>(MAT_DIALOG_DATA);
  readonly rejectReason = new FormControl('', {
    nonNullable: true,
    validators:
      this.data.targetStatus === 'REJECTED' ? [Validators.required, Validators.minLength(10)] : [],
  });

  confirm(): void {
    this.rejectReason.markAsTouched();
    if (this.rejectReason.invalid) return;

    const rejectReason = this.rejectReason.value.trim();
    this.dialogRef.close({
      targetStatus: this.data.targetStatus,
      rejectReason: rejectReason || undefined,
    });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
