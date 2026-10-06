export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'IGNORED';

export type RiskTypeCode =
  | 'REVIEW_RISK'
  | 'LOGISTICS_RISK'
  | 'INVENTORY_RISK'
  | 'PENALTY_CAP'
  | 'HEAT_CRASH'
  | 'HEAT_SURGE'
  | 'SEASON_MISMATCH'
  | 'FESTIVAL_WINDOW_CLOSING'
  | 'LOW_CONFIDENCE'
  | 'DATA_INSUFFICIENT';

export interface RiskAlertItem {
  id: number;
  productId: number;
  productName: string;
  categoryId?: number | null;
  categoryName?: string | null;
  riskType: RiskTypeCode | string;
  severity: Severity | string;
  triggerValue: string;
  impact?: string | null;
  detectedAt: string;
  status: AlertStatus | string;
  ignoreReason?: string | null;
  handledAt?: string | null;
  handledBy?: number | string | null;
  handledByName?: string | null;
}

export interface RiskSummary {
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  monthlyHandledCount: number;
  lastDetectedAt?: string | null;
}

export interface RecalculationStatus {
  lastError?: string | null;
  running: boolean;
  progressPercent: number;
  status?: string;
  errorMessage?: string | null;
  startedAt?: string | null;
  updatedAt?: string | null;
}

export interface RiskRuleItem {
  categoryId?: number | null;
  ruleCode: RiskTypeCode | string;
  ruleName?: string;
  description?: string;
  severity?: Severity | string;
  enabled: boolean;
  thresholdJson: Record<string, unknown>;
  maxPenalty?: number;
  updatedAt?: string;
}

export interface RiskRulesResponse {
  rules: RiskRuleItem[];
  recalculation: RecalculationStatus;
}

export interface RiskListResponse {
  content: RiskAlertItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface RiskFilterState {
  status: 'ALL' | AlertStatus;
  severity: 'ALL' | Severity;
  riskType: 'ALL' | RiskTypeCode | string;
  categoryId: number | 'ALL';
  keyword?: string;
}

export interface RiskTypeMeta {
  label: string;
  description: string;
}

export const RISK_TYPE_META: Record<string, RiskTypeMeta> = {
  REVIEW_RISK: { label: '負評風險', description: '負評率高於設定門檻' },
  LOGISTICS_RISK: { label: '物流風險', description: '夏季易融、需冷鏈、易碎或超材' },
  INVENTORY_RISK: { label: '庫存/效期風險', description: '短保質期、季節性壓庫、起訂量過高' },
  PENALTY_CAP: { label: '扣分上限示警', description: '總扣分達到 20 分以上' },
  HEAT_CRASH: { label: '熱度驟降', description: '7 日斜率急跌 (≤ -0.40)' },
  HEAT_SURGE: { label: '異常暴增', description: '7 日斜率達同品類當日 P95，且熱度量級達下限' },
  SEASON_MISMATCH: { label: '季節不匹配', description: '氣候適配百分位 < 20' },
  FESTIVAL_WINDOW_CLOSING: { label: '節慶窗口關閉', description: '距離節慶商機窗口不足 7 日' },
  LOW_CONFIDENCE: { label: '信心度偏低', description: '演算法信心度 < 50' },
  DATA_INSUFFICIENT: {
    label: '資料不足',
    description: '六項加分因子中，可用資料少於三項，無法產生評分；預設為中風險',
  },
};
