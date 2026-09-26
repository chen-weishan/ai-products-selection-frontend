import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { CreateAiTaskRequest } from '../../../api';

export interface CreateTaskDialogResult {
  taskType: CreateAiTaskRequest.TaskTypeEnum;
  productIds: number[];
  forceRefresh: boolean;
}

@Component({
  selector: 'app-create-task-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
  ],
  templateUrl: './create-task-dialog.component.html',
  styleUrl: './create-task-dialog.component.scss',
})
export class CreateTaskDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CreateTaskDialogComponent, CreateTaskDialogResult | null>);

  readonly taskTypes = [
    { value: CreateAiTaskRequest.TaskTypeEnum.FullAnalysis, label: '全量綜合分析 (Agent 1~4 全流程)', pool: 'A 軌' },
    { value: CreateAiTaskRequest.TaskTypeEnum.SceneClassify, label: '場景分類 (Agent 1: Scene Classification)', pool: 'A 軌' },
    { value: CreateAiTaskRequest.TaskTypeEnum.ReviewRisk, label: '評論與負評風險 (Agent 2: Review Risk)', pool: 'A 軌' },
    { value: CreateAiTaskRequest.TaskTypeEnum.SellingPoint, label: '賣點與洞察 (Agent 3: Product Insight)', pool: 'A 軌' },
    { value: CreateAiTaskRequest.TaskTypeEnum.Recommendation, label: '選品推薦度評定 (Agent 4: Recommendation)', pool: 'A 軌' },
    { value: CreateAiTaskRequest.TaskTypeEnum.TrendInterpret, label: '趨勢解讀與動能分析 (Trend Interpretation)', pool: 'A 軌' },
    { value: CreateAiTaskRequest.TaskTypeEnum.SourcingScout, label: '尋源探索與生命週期 (Sourcing Scout)', pool: 'B 軌' },
    { value: CreateAiTaskRequest.TaskTypeEnum.WeightCalibration, label: '權重版本校準分析 (Weight Calibration)', pool: 'RETRY 池' },
  ];

  readonly form = new FormGroup({
    taskType: new FormControl<CreateAiTaskRequest.TaskTypeEnum>(CreateAiTaskRequest.TaskTypeEnum.FullAnalysis, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    productIdsInput: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    forceRefresh: new FormControl<boolean>(false, {
      nonNullable: true,
    }),
  });

  parseProductIds(input: string): number[] {
    if (!input || !input.trim()) return [];
    const tokens = input.split(/[\s,，、\n\r\t]+/);
    const ids = tokens
      .map((t) => Number(t.trim()))
      .filter((n) => !isNaN(n) && Number.isInteger(n) && n > 0);
    return Array.from(new Set(ids));
  }

  get parsedIds(): number[] {
    return this.parseProductIds(this.form.controls.productIdsInput.value);
  }

  get isValid(): boolean {
    return this.form.valid && this.parsedIds.length > 0;
  }

  onSubmit(): void {
    if (!this.isValid) return;
    const taskType = this.form.controls.taskType.value;
    const productIds = this.parsedIds;
    const forceRefresh = this.form.controls.forceRefresh.value;

    this.dialogRef.close({
      taskType,
      productIds,
      forceRefresh,
    });
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
