export type ImportDataType = 'SALES' | 'REVIEW' | 'AUDIENCE' | 'PRODUCT';
export type ImportTaskStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'PARTIAL'
  | 'CANCELLED';
export type ImportValueType = 'STRING' | 'INTEGER' | 'LONG' | 'DECIMAL' | 'DATE' | 'ENUM';
export type ImportMappingStatus = 'AUTO_MAPPED' | 'UNMAPPED' | 'BLOCKED_PERSONAL_DATA';

export interface ImportColumnSuggestion {
  sourceHeader: string;
  systemField?: string;
  status: ImportMappingStatus;
  confidence: number;
}

export interface ImportUploadResponse {
  batchId: number;
  dataType: ImportDataType;
  fileName: string;
  fileSize: number;
  totalRows: number;
  async: boolean;
  headers: string[];
  mappingSuggestions: ImportColumnSuggestion[];
}

export interface ImportField {
  key: string;
  label: string;
  valueType: ImportValueType;
  required: boolean;
}

export interface ImportPreviewIssue {
  field?: string;
  message: string;
  type: 'ERROR' | 'DUPLICATE';
}

export interface ImportPreviewRow {
  rowNumber: number;
  values: Record<string, string>;
  issues: ImportPreviewIssue[];
}

export interface ImportPreviewResponse {
  batchId: number;
  dataType: ImportDataType;
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  async: boolean;
  previewRows: ImportPreviewRow[];
}

export interface ImportBatchResponse {
  batchId: number;
  dataType: ImportDataType;
  fileName: string;
  fileSize?: number;
  totalRows: number;
  successRows: number;
  failRows: number;
  processedRows: number;
  progressPercent: number;
  status: ImportTaskStatus;
  async: boolean;
  createdBy?: string;
  createdAt: string;
  finishedAt?: string;
}

export interface ImportMappingTemplate {
  id: number;
  name: string;
  dataType: ImportDataType;
  mappings: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ImportMappingTemplateRequest {
  name: string;
  dataType: ImportDataType;
  mappings: Record<string, string>;
}

export interface ImportPage<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
