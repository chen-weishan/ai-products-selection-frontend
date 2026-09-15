/**
 * FR-04 選品分數排行（S-05）。欄位與後端 ssds-api 的 DTO 一一對應。
 *
 * SceneType／FactorCode／ApiResponse／PageResponse 沿用 weight.ts 的定義，
 * 不重複宣告——同一個後端 enum 在前端有兩份型別時，改一邊就會漏改另一邊。
 */
import { FactorCode, SceneType } from './weight';

export type Grade = 'A' | 'B' | 'C';

/** 三個扣分因子（後端 FactorCode 的 isPenalty() 子集）。不參與權重。 */
export type PenaltyFactorCode = 'REVIEW_RISK' | 'LOGISTICS_RISK' | 'INVENTORY_RISK';

/**
 * 排行列上的一根因子長條。
 *
 * dataAvailable = false 時畫灰底空條，且該因子不扣分（§5.7）。
 * 判斷有無資料只能看 dataAvailable：此時 weight 可能是 null 也可能是 0，
 * 寫成 weight == null 會漏判。
 */
export interface ScoreFactorBar {
  factorCode: FactorCode;
  /** 同品類百分位正規化後的 0–100（§5.3.1）。無資料時為 null。 */
  normalizedValue: number | null;
  weight: number | null;
  dataAvailable: boolean;
  imputed: boolean;
}

/**
 * 排行榜的一列。
 *
 * penaltySubtotal 是 0–40 的**正值**（AC-04-7），負號由 UI 加；
 * 這裡再加一次負號會變成正的。
 */
export interface ScoreRankingRow {
  scoreId: number;
  productId: number;
  productName: string;
  categoryName: string | null;
  sceneType: SceneType;
  isPrimary: boolean;
  bonusSubtotal: number;
  penaltySubtotal: number;
  finalScore: number;
  grade: Grade;
  confidence: number;
  lowConfidence: boolean;
  riskSuppressed: boolean;
  /** 只含六個加分因子，且**順序不保證**，畫面須自行依 FACTOR_CODES 排。 */
  factors: ScoreFactorBar[];
}

/** 單一扣分因子。penaltyValue 與 rawValue 都可能是 null，不能當 0 顯示。 */
export interface DeductionItem {
  factorCode: PenaltyFactorCode;
  /** 實際扣掉的分數，正值。dataAvailable = false 時為 null（§5.7 沒資料就不扣分）。 */
  penaltyValue: number | null;
  rawValue: number | null;
  /** false 代表這項風險無資料可判定，UI 應標示「未評估」而非「無風險」。 */
  dataAvailable: boolean;
}

/**
 * 扣分明細卡。
 *
 * penaltySubtotal 不等於 items 的加總——可能有小計卻沒有任何明細列，
 * 小計一律直接用這個欄位。
 *
 * riskSuppressed 是後端依 §5.6 硬規則（扣分 ≥ 20）判好的布林，
 * 前端不要自己寫 penaltySubtotal >= 20。
 */
export interface ScoreDeductions {
  scoreId: number;
  penaltySubtotal: number;
  riskSuppressed: boolean;
  items: DeductionItem[];
}

/** POST /scores/simulate。只試算不寫入資料庫。 */
export interface SimulateRequest {
  weightVersionId: number;
  period: string;
  scene?: SceneType | null;
  categoryId?: number | null;
  limit?: number | null;
}

export const GRADE_LABELS: Record<Grade, string> = { A: 'A', B: 'B', C: 'C' };

export const PENALTY_FACTOR_LABELS: Record<PenaltyFactorCode, string> = {
  REVIEW_RISK: '評論風險',
  LOGISTICS_RISK: '物流風險',
  INVENTORY_RISK: '庫存風險',
};

/** 榜名。S-05 的分頁標題用這組，與 S-09 的「型」不同（那是權重組名）。 */
export const SCENE_BOARD_LABELS: Record<SceneType, string> = {
  VIRAL: '話題爆款榜',
  FESTIVAL: '節慶檔期榜',
  REPLENISHMENT: '常態補貨榜',
  SEASONAL: '季節導向榜',
};
