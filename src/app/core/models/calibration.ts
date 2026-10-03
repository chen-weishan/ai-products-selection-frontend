/**
 * FR-15 權重校準閉環（S-19）。欄位與後端 CalibrationReportResponse／BacktestResponse 對應。
 * regression／backtest 為資料庫 JSON 原樣，欄位定義見後端 CalibrationReportService 的 Javadoc。
 */
import { FactorCode, SceneType } from './weight';

export type CalibrationStatus = 'PENDING' | 'APPROVED' | 'PARTIAL' | 'REJECTED';
export type ReviewAction = 'APPROVE' | 'PARTIAL' | 'REJECT';

/** S-19 因子預測力表一列。dev seed 的舊格式報告只有 factors（無 n／sceneType／sufficient）。 */
export interface FactorRow {
  code: FactorCode;
  n?: number;
  correlation: number | null;
  pValue: number | null;
  sufficient?: boolean;
  sceneType?: SceneType;
  currentWeight: number;
  suggestedWeight: number;
}

export interface SceneWeightRow {
  code: FactorCode;
  currentWeight: number;
  suggestedWeight: number;
}

export interface RegressionResult {
  method: string;
  sampleSize?: number;
  minSample?: number;
  shrinkage?: number;
  baseVersionId?: number;
  baseVersionNo?: string;
  cutoff?: string;
  /** 實際產生時間（重算會更新；createdAt 不會）。舊格式報告沒有此欄。 */
  generatedAt?: string;
  note?: string;
  factors: FactorRow[];
  factorRows?: FactorRow[];
  scenes?: { sceneType: SceneType; weights: SceneWeightRow[] }[];
}

/** 回測一列。新格式在 schemes[]（code），舊格式只有 backtests[]（scheme）。 */
export interface BacktestOutcome {
  code?: string;
  scheme?: string;
  label?: string;
  versionId?: number | null;
  sampleSize?: number;
  correlation: number | null;
  gradeACount?: number;
  gradeAHitCount?: number;
  gradeAHitRate: number | null;
}

export interface BacktestResult {
  sampleSize?: number;
  note?: string;
  backtests: BacktestOutcome[];
  schemes?: BacktestOutcome[];
}

export interface CalibrationReport {
  id: number;
  quarter: string;
  sampleSize: number;
  minSample: number;
  belowMinSample: boolean;
  validityWarning: string | null;
  status: CalibrationStatus;
  regression: RegressionResult | null;
  backtest: BacktestResult | null;
  aiInterpretation: string | null;
  /** Agent 7 輸出（後端 WeightCalibrationOutput）。 */
  adjustmentAdvice: AdjustmentAdvice[] | null;
  attentionNotes: string[] | null;
  aiModel: string | null;
  interpretedAt: string | null;
  acceptedFactors: FactorCode[];
  reviewedBy: string | null;
  reviewedAt: string | null;
  weightVersionId: number | null;
  weightVersionNo: string | null;
  createdAt: string;
}

export interface AdjustmentAdvice {
  factorCode: string;
  explanation: string;
}

export interface ReviewCalibrationRequest {
  action: ReviewAction;
  acceptedFactors: FactorCode[] | null;
  comment: string | null;
}

export interface BacktestComparison {
  cutoff: string;
  sampleSize: number;
  minSample: number;
  belowMinSample: boolean;
  validityWarning: string | null;
  results: BacktestOutcome[];
}

export const CALIBRATION_STATUS_LABELS: Record<CalibrationStatus, string> = {
  PENDING: '待審核',
  APPROVED: '已核准',
  PARTIAL: '部分採納',
  REJECTED: '已駁回',
};
