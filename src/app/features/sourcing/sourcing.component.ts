import { Component } from '@angular/core';
import { CategoryControllerService, CategoryTreeResponse } from '../../api'
import { inject } from '@angular/core';
import { signal } from '@angular/core';

@Component({
  selector: 'app-sourcing',
  imports: [],
  templateUrl: './sourcing.component.html',
  styleUrl: './sourcing.component.scss'
})
export class SourcingComponent {
  private categoryservice = inject(CategoryControllerService);
  categories = signal<CategoryTreeResponse[]>([]);
  selectCatgoryId = signal<number | null>(null);

  ngOnInit() {
    this.categoryservice.getCategories().subscribe({
      next: (res) => {
        this.categories.set(res.data ?? []);
      },
      error: (err) => {
        console.log('品類取得失敗', err);
      }
    })
  }
}
