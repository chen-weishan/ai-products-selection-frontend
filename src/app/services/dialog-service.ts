import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConfirmDialogData } from '../core/models/confirm-dialog-data-model';
import { ConfirmDialog } from '../shared/components/confirm-dialog/confirm-dialog';
import {
  ProductStatusDialogData,
  ProductStatusDialogResult,
} from '../core/models/product-status-dialog-model';
import { ProductStatusDialog } from '../shared/components/product-status-dialog/product-status-dialog';

@Injectable({
  providedIn: 'root',
})
export class DialogService {
  private dialog = inject(MatDialog);
  Confirm(data: ConfirmDialogData): Observable<boolean> {
    const dialogRef = this.dialog.open(ConfirmDialog, {
      data,
      panelClass: 'custom-confirm-dialog-panel',
      minWidth: '320px',
      maxWidth: '400px',
      disableClose: true,
    });
    return dialogRef.afterClosed().pipe(
      //!!result 不管哪種型態指回傳true false
      map((result) => !!result),
    );
  }

  ChangeProductStatus(data: ProductStatusDialogData): Observable<ProductStatusDialogResult | null> {
    return this.dialog
      .open<ProductStatusDialog, ProductStatusDialogData, ProductStatusDialogResult | null>(
        ProductStatusDialog,
        {
          data,
          minWidth: '360px',
          maxWidth: '480px',
          disableClose: true,
        },
      )
      .afterClosed()
      .pipe(map((result) => result ?? null));
  }
}
