import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { ProductService } from '../product.service';

@Component({
  selector: 'app-product-list',
  imports: [DecimalPipe, PercentPipe, MatButtonModule, MatTableModule],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.scss',
})
export class ProductListComponent implements OnInit {
  readonly productService = inject(ProductService);

  readonly displayedColumns = [
    'name',
    'category',
    'trackType',
    'supplier',
    'price',
    'margin',
    'score',
    'gradeOrGap',
    'status',
  ];

  ngOnInit(): void {
    this.loadFirstPage();
  }

  loadFirstPage(): void {
    this.productService.load({ page: 0, size: 20 }).subscribe({
      error: () => undefined,
    });
  }

}
