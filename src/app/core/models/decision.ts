/**
 * FR-11 採購決策與回饋閉環（S-12）。欄位與後端 ssds-api decision 套件的 DTO 一一對應。
 *
 * 比率（退貨率、實現毛利率、各項準確度指標）一律是 0–1，畫面顯示百分比時自行換算，
 * 送出時也要換回 0–1，不可把 39.4 這種值送給 API。
 */

import { ApiResponse, FactorCode, PageResponse, SceneType } from './weight';
import { DeductionItem, Grade, ScoreFactorBar } from './score';

export type { ApiResponse, PageResponse };

export type DecisionType = 'ADOPT' | 'WATCH' | 'REJECT';

export type ProductStatus = 'DRAFT' | 'EVALUATING' | 'WATCHING' | 'ADOPTED' | 'LISTED' | 'REJECTED';

/** 決策在閉環中走到哪一步。後端由 decision、品項狀態、結案日、回填是否存在推得。 */
export type DecisionStage = 'NO_CAMPAIGN' | 'AWAITING_LAUNCH' | 'IN_CAMPAIGN' | 'PENDING_RESULT' | 'COMPLETED';

export type SelloutStatus = 'EARLY_SELLOUT' | 'ON_TIME' | 'BELOW_TARGET' | 'SLOW';

export type PostNoteCode = 'FASTER_THAN_EXPECTED' | 'HEAT_PASSED' | 'QUALITY_ISSUE' | 'LOGISTICS_ISSUE' | 'OTHER';

export const DECISION_LABELS: Record<DecisionType, string> = {
  ADOPT: '採納',
  WATCH: '觀察',
  REJECT: '淘汰',
};

export const STAGE_LABELS: Record<DecisionStage, string> = {
  NO_CAMPAIGN: '不開團',
  AWAITING_LAUNCH: '待開團',
  IN_CAMPAIGN: '開團中',
  PENDING_RESULT: '待回填',
  COMPLETED: '已回填',
};

/** 決策類型 → 狀態標籤配色（FRONTEND_UI_GUIDELINES §4.2）。清單、詳情、對話框共用同一張表。 */
export const DECISION_BADGE_CLASS: Record<DecisionType, string> = {
  ADOPT: 'status-normal',
  WATCH: 'status-quota',
  REJECT: 'status-warn',
};

/** 閉環階段 → 狀態標籤配色。逾期另以 status-warn 覆蓋（見元件 stageClass）。 */
export const STAGE_BADGE_CLASS: Record<DecisionStage, string> = {
  NO_CAMPAIGN: 'override-badge',
  AWAITING_LAUNCH: 'status-quota',
  IN_CAMPAIGN: 'override-badge',
  PENDING_RESULT: 'status-quota',
  COMPLETED: 'status-normal',
};

export const SELLOUT_LABELS: Record<SelloutStatus, string> = {
  EARLY_SELLOUT: '提前售罄',
  ON_TIME: '如期完售',
  BELOW_TARGET: '未達標',
  SLOW: '滯銷',
};

export const POST_NOTE_LABELS: Record<PostNoteCode, string> = {
  FASTER_THAN_EXPECTED: '爆得比預期快',
  HEAT_PASSED: '熱度已過',
  QUALITY_ISSUE: '品質問題',
  LOGISTICS_ISSUE: '物流出狀況',
  OTHER: '其他',
};

export const HEAT_SOURCE_LABELS: Partial<Record<string, string>> = {
  THREADS: 'Threads',
  GOOGLE_TRENDS: 'Trends',
  INSTAGRAM: 'IG',
  MANUAL: '人工標記',
};

export const SOURCE_AVAILABILITY_LABELS: Partial<Record<string, string>> = {
  AVAILABLE: '可用',
  DEGRADED: '降級',
  UNAVAILABLE: '不可用',
  DISABLED: '停用',
};

export interface CampaignResult {
  actualQty: number;
  selloutStatus: SelloutStatus;
  returnRate: number | null;
  realizedMarginRate: number | null;
  postNoteCode: PostNoteCode | null;
  postNoteText: string | null;
  filledById: number | null;
  filledByName: string | null;
  filledAt: string | null;
}

export interface Decision {
  id: number;
  productId: number;
  productName: string;
  categoryName: string | null;
  productStatus: ProductStatus;
  decision: DecisionType;
  /** 決策當下沒有 AI 建議時為 null。 */
  aiAction: DecisionType | null;
  followedAi: boolean;
  aiQtyMin: number | null;
  aiQtyMax: number | null;
  firstOrderQty: number | null;
  expectedListDate: string | null;
  campaignEndDate: string | null;
  reason: string | null;
  decidedById: number;
  decidedByName: string;
  decidedAt: string;
  reviewedById: number | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  scoreId: number;
  period: string;
  sceneType: SceneType;
  finalScore: number;
  grade: Grade;
  stage: DecisionStage;
  /** 今日 − 結案日 − 7，僅待回填且 > 0 時有值（AC-11-3）。 */
  overdueDays: number | null;
  result: CampaignResult | null;
}

/** 後端 ScoreDetailResponse（FR-04 共用形狀）。 */
export interface ScoreDetail {
  scoreId: number;
  productId: number;
  productName: string;
  categoryName: string | null;
  period: string;
  sceneType: SceneType;
  isPrimary: boolean;
  bonusSubtotal: number;
  penaltySubtotal: number;
  finalScore: number;
  grade: Grade;
  confidence: number;
  lowConfidence: boolean;
  riskSuppressed: boolean;
  bonusFactors: ScoreFactorBar[];
  penaltyFactors: DeductionItem[];
}

export interface DecisionSnapshot {
  decisionId: number;
  score: ScoreDetail;
  weightVersionId: number | null;
  weightVersionNo: string | null;
  aiSceneType: SceneType | null;
  aiConfidence: number | null;
  sceneOverridden: boolean;
  overriddenByName: string | null;
  overrideReason: string | null;
  decision: DecisionType;
  aiAction: DecisionType | null;
  followedAi: boolean;
  aiQtyMin: number | null;
  aiQtyMax: number | null;
  /** 鍵為熱度來源代碼。V17 之前的舊資料可能為 null。 */
  sourceAvailability: Record<string, string> | null;
  appliedCompositeWeights: Record<string, number> | null;
  appliedThresholds: { sceneType: SceneType | null; gradeAMin: number | null; gradeBMin: number | null } | null;
  decidedByName: string;
  decidedAt: string;
  snapshotCreatedAt: string | null;
}

export interface DecisionAccuracy {
  from: string | null;
  to: string | null;
  categoryId: number | null;
  decidedBy: number | null;
  totalDecisions: number;
  sampleSize: number;
  /** 分母為 0 或無變異時為 null，畫面顯示「—」而不是 0。 */
  scoreSalesCorrelation: number | null;
  gradeAHitRate: number | null;
  gradeAHitCount: number;
  gradeASampleSize: number;
  sceneOverrideRate: number | null;
  sceneOverrideCount: number;
  /** followed_ai = true 的比例，分母為 totalDecisions（§FR-11-3）。 */
  aiAdoptionRate: number | null;
  aiFollowedCount: number;
  minSample: number;
  belowMinSample: boolean;
  validityWarning: string | null;
}

export interface DecisionContext {
  productId: number;
  productName: string;
  productStatus: ProductStatus;
  trackType: 'A' | 'B';
  score: { scoreId: number; period: string; sceneType: SceneType; finalScore: number; grade: Grade } | null;
  ai: {
    action: DecisionType;
    qtyMin: number | null;
    qtyMax: number | null;
    quantityText: string | null;
    reasoning: string | null;
  } | null;
  allowedDecisions: DecisionType[];
  blockedReason: string | null;
}

export interface CreateDecisionRequest {
  decision: DecisionType;
  firstOrderQty: number | null;
  expectedListDate: string | null;
  reason: string | null;
}

export interface CampaignResultRequest {
  actualQty: number;
  selloutStatus: SelloutStatus;
  returnRate: number | null;
  realizedMarginRate: number;
  postNoteCode: PostNoteCode | null;
  postNoteText: string | null;
}

export interface DecisionSearch {
  from?: string | null;
  to?: string | null;
  decidedBy?: number | null;
  categoryId?: number | null;
  productId?: number | null;
  decision?: DecisionType | null;
  pendingResult?: boolean | null;
  page?: number;
  size?: number;
}

export interface AccuracySearch {
  from?: string | null;
  to?: string | null;
  categoryId?: number | null;
  decidedBy?: number | null;
}

/** 建立決策表單挑品項用的最小欄位（GET /products 清單列）。 */
export interface ProductOption {
  id: number;
  name: string;
  categoryName: string | null;
  status: ProductStatus;
  latestScore: number | null;
  grade: Grade | null;
}

export type { FactorCode };
