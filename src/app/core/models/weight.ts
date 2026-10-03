/**
 * FR-08 情境權重組（S-09）。欄位與後端 ssds-api 的 DTO 一一對應。
 */

/** 四榜（情境）。後端 SceneType。 */
export type SceneType = 'VIRAL' | 'FESTIVAL' | 'REPLENISHMENT' | 'SEASONAL';

/** 六個加分因子。扣分因子不參與權重，故不列入。後端 FactorCode 的 !isPenalty() 子集。 */
export type FactorCode = 'TREND' | 'MARGIN' | 'CVR' | 'PRICE_FIT' | 'FESTIVAL' | 'CLIMATE';

export type WeightVersionStatus = 'DRAFT' | 'APPROVED' | 'RETIRED';

/** 統一回應封套（規格書 §8.1）。 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: ApiError;
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
  fieldErrors?: FieldError[];
}

export interface FieldError {
  field: string;
  message: string;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** 清單用摘要，不含 sceneGroups。 */
export interface WeightVersionSummary {
  id: number;
  versionNo: string;
  name: string;
  status: WeightVersionStatus;
  isCurrent: boolean;
  effectiveFrom: string | null;
  changeNote: string | null;
  createdAt: string;
  approvedAt: string | null;
}

/** 一個榜的完整規則：六因子權重 + A／B 門檻。weightSum 由後端算好。 */
export interface SceneWeightGroup {
  sceneType: SceneType;
  weights: Record<FactorCode, number>;
  weightSum: number;
  gradeAMin: number;
  gradeBMin: number;
}

export interface WeightVersionDetail extends WeightVersionSummary {
  sceneGroups: SceneWeightGroup[];
}

/** POST / PUT 的請求體。門檻與權重同層，見後端 SceneGroupRequest。 */
export interface SceneGroupRequest {
  sceneType: SceneType;
  weights: Record<FactorCode, number>;
  gradeAMin: number;
  gradeBMin: number;
}

export interface CreateWeightVersionRequest {
  versionNo: string;
  name: string;
  changeNote: string | null;
  sceneGroups: SceneGroupRequest[];
}

/** 核准只指定生效日，不是編輯的機會（§FR-08 版本管理表）。 */
export interface ApproveWeightVersionRequest {
  effectiveFrom: string;
}

/**
 * GET /weight-versions/{id}/scene-stats（§8.2，v3.0 補入；S-09「AI 選組規則卡」）。
 * 統計單位是品項：版本生效區間內每個品項只看最新一筆判定。
 * 比率為 0–1，分母 0 時為 null。
 */
export interface SceneStats {
  weightVersionId: number;
  /** 生效區間起日（含）；草稿為 null。 */
  windowFrom: string | null;
  /** 生效區間終日（不含）＝下一版生效日；生效中版本為 null（至今）。 */
  windowTo: string | null;
  judgedCount: number;
  overriddenCount: number;
  overrideRate: number | null;
  /** AI 判定失敗（ai_scene_type 為 NULL）者，不歸入任何情境。 */
  aiFailedCount: number;
  /** 固定四列，依 SCENE_TYPES 順序。 */
  scenes: SceneStat[];
}

export interface SceneStat {
  sceneType: SceneType;
  /** AI 判為此情境的品項數。 */
  aiJudgedCount: number;
  overriddenCount: number;
  overrideRate: number | null;
  /** 最終採用此情境的品項數（每組品項數）。 */
  finalCount: number;
}

/** 畫面顯示用的中文標籤。 */
export const SCENE_TYPES: SceneType[] = ['VIRAL', 'FESTIVAL', 'REPLENISHMENT', 'SEASONAL'];

export const FACTOR_CODES: FactorCode[] = [
  'TREND',
  'MARGIN',
  'CVR',
  'PRICE_FIT',
  'FESTIVAL',
  'CLIMATE',
];

export const SCENE_LABELS: Record<SceneType, string> = {
  VIRAL: '話題爆款型',
  FESTIVAL: '節慶檔期型',
  REPLENISHMENT: '常態補貨型',
  SEASONAL: '季節導向型',
};

/** 門檻卡用的短名：「話題爆款榜門檻」。 */
export const SCENE_SHORT_LABELS: Record<SceneType, string> = {
  VIRAL: '話題爆款',
  FESTIVAL: '節慶檔期',
  REPLENISHMENT: '常態補貨',
  SEASONAL: '季節導向',
};

export const FACTOR_LABELS: Record<FactorCode, string> = {
  TREND: '熱度斜率',
  MARGIN: '毛利率',
  CVR: '轉換率',
  PRICE_FIT: '價格帶適配',
  FESTIVAL: '節慶窗',
  CLIMATE: '氣候',
};

export const STATUS_LABELS: Record<WeightVersionStatus, string> = {
  DRAFT: '草稿',
  APPROVED: '已核准',
  RETIRED: '已停用',
};
