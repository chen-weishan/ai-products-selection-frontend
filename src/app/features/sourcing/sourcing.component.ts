import { Component } from '@angular/core';
import { AiBudgetControllerService } from '../../api'
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
  private readonly budgetService = inject(AiBudgetControllerService);
  categories = signal<CategoryTreeResponse[]>([]);
  selectedCategoryId = signal<number | null>(null);

  ngOnInit() {
    this.categories.set(PRESET_CATEGORIES);
    this.budgetService.current().subscribe({
      next: (res) => {
        const trackB = res.data?.pools?.find(pool => pool.pool === 'TRACK_B');
        if (trackB) {
          this.frequency = `${trackB.used ?? 0}/${trackB.limit ?? 0}`;
        }
      },
      error: (err) => {
        console.warn('[SourcingComponent] 無法取得 AI 預算：', err);
      }
    })
  }
  //假資料
  frequency = '18/50';

}

interface CategoryTreeResponse {
  id: number;
  name: string;
  leadTimeDays: number;
  children?: CategoryTreeResponse[];
}

const PRESET_CATEGORIES: CategoryTreeResponse[] = [
  { id: 1, name: '零食（國產）', leadTimeDays: 21 },
  { id: 2, name: '進口食品／特產', leadTimeDays: 45 },
  { id: 3, name: '常溫飲料／沖泡', leadTimeDays: 30 },
  { id: 4, name: '調味醬料／抹醬', leadTimeDays: 35 },
  { id: 5, name: '生鮮／短效期冷藏', leadTimeDays: 14 },
];
