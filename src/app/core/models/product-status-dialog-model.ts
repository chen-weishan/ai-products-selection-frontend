import { ProductStatusUpdateRequest } from '../../api/model/models';

export interface ProductStatusDialogData {
  productName: string;
  targetStatus: ProductStatusUpdateRequest.TargetStatusEnum;
  targetStatusLabel: string;
}

export interface ProductStatusDialogResult {
  targetStatus: ProductStatusUpdateRequest.TargetStatusEnum;
  rejectReason?: string;
}
