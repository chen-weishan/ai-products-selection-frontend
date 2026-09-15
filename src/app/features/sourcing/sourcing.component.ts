import { Component } from '@angular/core';
import { CategoryControllerService, CategoryTreeResponse } from '../../api'
import { inject } from '@angular/core';
import { signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-sourcing',
  imports: [MatFormFieldModule, MatSelectModule, MatInputModule, FormsModule, CommonModule],
  templateUrl: './sourcing.component.html',
  styleUrl: './sourcing.component.scss'
})
export class SourcingComponent {
  private readonly categoryservice = inject(CategoryControllerService);
  categories = signal<CategoryTreeResponse[]>([]);
  selectedCategoryId = signal<number | null>(null);

  ngOnInit() {
    this.categoryservice.getCategories().subscribe({
      next: (res) => {
        this.categories.set(res.data ?? [])
        console.log('回傳成功', res.data)
      },
      error: (err) => {
        console.log('品類取得失敗', err);
      }
    })
  }
  //假資料
  frequency = '18/50';

}
