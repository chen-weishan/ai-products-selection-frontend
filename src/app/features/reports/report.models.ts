export type ReportType =
  | 'WEEKLY_PICK'
  | 'SCORE_DETAIL'
  | 'ACCURACY'
  | 'SOURCING_QUEUE'
  | 'CALIBRATION';

export type ReportFormat = 'PDF' | 'XLSX';
export type ReportStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'PARTIAL'
  | 'CANCELLED';

export interface ReportGenerateRequest {
  reportType: ReportType;
  format: ReportFormat;
  params: Record<string, string | number>;
}

export interface ReportJob {
  id: number;
  reportType: ReportType;
  format: ReportFormat;
  params: Record<string, string | number>;
  status: ReportStatus;
  fileName?: string | null;
  fileSize?: number | null;
  rowCount?: number | null;
  requestedAt: string;
  finishedAt?: string | null;
  downloadable: boolean;
}

export interface ReportPage {
  content: ReportJob[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ReportCategoryOption {
  id: number;
  label: string;
}

export interface ReportDecisionMakerOption {
  id: number;
  displayName: string;
  email: string;
}

export interface ReportFilterOptions {
  categories: ReportCategoryOption[];
  decisionMakers: ReportDecisionMakerOption[];
  scorePeriods: string[];
  calibrationQuarters: string[];
}
