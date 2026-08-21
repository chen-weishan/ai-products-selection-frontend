import { Component,inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ConfirmDialogData } from '../../../core/models/confirm-dialog-data-model';
@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule,MatButtonModule,MatIconModule],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialog {
readonly dialogRef=inject(MatDialogRef<ConfirmDialog>);
readonly data:ConfirmDialogData=inject(MAT_DIALOG_DATA);

onConfirm():void{
  this.dialogRef.close(true);
}

onCancel():void{
  this.dialogRef.close(false);
}
}
