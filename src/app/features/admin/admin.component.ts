import { Component,inject } from '@angular/core';
import{MatButtonModule}from '@angular/material/button';
import{DialogService}from '../../services/dialog-service';
import{HttpClient}from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
@Component({
  selector: 'app-admin',
  imports: [MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent {
  private  readonly dialogService = inject(DialogService);
  private readonly httpClient = inject(HttpClient);

  testNormalDialog(): void {
    this.dialogService.Confirm({
      'title': '系統通知確認',
      'message': '這是一般確認視窗，您確定要繼續執行嗎？',
      'confirmText':'確認執行',
      'cancelText':'取消',
      'isDanger': false
    }).subscribe(result => {
      console.log('一般彈窗回傳結果：', result);
    });
  }
   NormalDialog(): void {
    this.dialogService.Confirm({
      'title': '',
      'message': '',
      'confirmText':'',
      'cancelText':'',
      'isDanger': false
    }).subscribe(result => {
      console.log('一般彈窗回傳結果：', result);
    });
  }

  // 3. 測試危險操作
  testDangerDialog(): void {
    this.dialogService.Confirm({
      'title': '刪除管理員警告',
      'message': '此操作將移除該管理員帳號與所有授權權限，確認要刪除嗎？',
      'confirmText': '強制刪除',
      'cancelText':'返回',
      'isDanger': true
    }).subscribe(result => {
      console.log('危險彈窗回傳結果：', result);
    });
  }

testLoadingApi(){
  this.httpClient.get('https://httpbin.org/delay/20000').subscribe(
    {
      next:(res)=>console.log('回傳成功',res),
      error:(err)=>console.error('回傳錯誤',err)
    })
}

}



