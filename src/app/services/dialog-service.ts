import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConfirmDialogData } from '../core/models/confirm-dialog-data-model';
import { ConfirmDialog } from '../shared/components/confirm-dialog/confirm-dialog';

@Injectable({
  providedIn: 'root',
})
export class DialogService {
  private dialog = inject(MatDialog);
  Confirm(data:ConfirmDialogData):Observable<boolean>{
  const dialogRef=this.dialog.open(ConfirmDialog,{
    data,
    panelClass: 'custom-confirm-dialog-panel',
    width:'10vw',
    disableClose:true,
  });
  return dialogRef.afterClosed().pipe(
    //!!result 不管哪種型態指回傳true false
    map(result=>!!result)
  )
  }
}
