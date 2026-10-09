/**
 * S-14 風險規則分頁：threshold_json 各欄位的中文名稱、單位與範圍，
 * 範圍與後端 RiskAlertRuleCommandService#validate 一致。
 *
 * scale：畫面值 × scale ＝ 存檔值。百分比欄位用 0.01；HEAT_CRASH 跌幅用 -0.01（畫面填 40 → 存 -0.4）。
 */
export interface RuleFieldSpec {
  key: string;
  label: string;
  unit: string;
  hint?: string;
  min: number;
  max: number;
  /** 下限不含等號 */
  minExclusive?: boolean;
  step: number;
  integer?: boolean;
  scale?: number;
}

export interface PenaltySpec {
  max: number;
  hint: string;
}

const points = (key: string, label: string, hint?: string): RuleFieldSpec => ({
  key, label, unit: '分', min: 0, max: 10, step: 0.5, hint,
});

export const RULE_FIELDS: Record<string, RuleFieldSpec[]> = {
  REVIEW_RISK: [
    { key: 'negativeRateThreshold', label: '負評率門檻', unit: '%', min: 0, max: 100, step: 1, scale: 0.01, hint: '負評率高於此值才扣分' },
    { key: 'minSampleSize', label: '最低評論數', unit: '則', min: 1, max: 100000, step: 1, integer: true, hint: '評論數不足時不判定' },
  ],
  LOGISTICS_RISK: [
    points('meltableSummerPoints', '夏季易融扣分'),
    points('coldChainPoints', '冷藏／冷凍扣分'),
    points('fragilePoints', '易碎扣分'),
    points('oversizedPoints', '超材扣分'),
  ],
  INVENTORY_RISK: [
    { key: 'shelfLifeDaysThreshold', label: '短效期門檻', unit: '天', min: 0, max: 3650, step: 1, integer: true, hint: '保存期限短於此天數視為短效期' },
    points('shortShelfLifePoints', '短效期扣分'),
    points('seasonalPoints', '季節性壓庫扣分'),
    { key: 'moqThreshold', label: '起訂量門檻', unit: '件', min: 0, max: 1000000, step: 10, integer: true, hint: '最低起訂量高於此值視為過高' },
    points('highMoqPoints', '起訂量過高扣分'),
  ],
  HEAT_CRASH: [
    { key: 'slope7dThreshold', label: '七日熱度跌幅', unit: '%', min: 0, max: 100, minExclusive: true, step: 1, scale: -0.01, hint: '七日斜率跌超過此幅度就示警' },
  ],
  HEAT_SURGE: [
    { key: 'slopePercentile', label: '同品類斜率百分位', unit: 'P', min: 0, max: 100, minExclusive: true, step: 1, scale: 0.01, hint: '七日斜率達同品類當日此百分位以上才示警' },
  ],
  LOW_CONFIDENCE: [
    { key: 'confidenceThreshold', label: '信心度門檻', unit: '分', min: 0, max: 100, step: 1, integer: true, hint: '演算法信心度低於此值就示警' },
  ],
  SEASON_MISMATCH: [
    { key: 'climateFitPercentileThreshold', label: '氣候適配百分位門檻', unit: 'P', min: 0, max: 100, minExclusive: true, step: 1, hint: '氣候適配度低於此百分位就示警' },
  ],
  FESTIVAL_WINDOW_CLOSING: [
    { key: 'daysBeforeLeadTimeCutoff', label: '提前提醒天數', unit: '天', min: 1, max: 30, step: 1, integer: true, hint: '距離前置期截止不足此天數就示警' },
  ],
};

/** 有扣分上限的三類扣分規則（§5.2.2）。 */
export const PENALTY_SPECS: Record<string, PenaltySpec> = {
  REVIEW_RISK: { max: 20, hint: '此規則合計最多扣幾分' },
  LOGISTICS_RISK: { max: 10, hint: '各條件扣分加總後的上限' },
  INVENTORY_RISK: { max: 10, hint: '各條件扣分加總後的上限' },
};

/** 不開放調整的規則與原因。 */
export const LOCKED_RULES: Record<string, string> = {
  PENALTY_CAP: '扣分合計達 20 分即示警，此門檻由規格固定，不開放調整。',
};

export const LOGISTICS_CONDITION_LABELS: Record<string, string> = {
  CHILLED: '冷藏',
  FROZEN: '冷凍',
  FRAGILE: '易碎',
  MELTABLE: '易融',
  OVERSIZED: '超材',
};

/** 規則裡有、但上表沒定義的數值欄位，退回通用欄位，避免後端新增欄位時畫面直接看不到。 */
export function fieldsFor(ruleCode: string, threshold: Record<string, unknown>): RuleFieldSpec[] {
  const known = RULE_FIELDS[ruleCode] ?? [];
  const extra = Object.entries(threshold)
    .filter(([key, value]) => typeof value === 'number' && !known.some((field) => field.key === key))
    .map(([key]) => ({ key, label: key, unit: '', min: -1e9, max: 1e9, step: 1 }));
  return [...known.filter((field) => field.key in threshold), ...extra];
}

export function toDisplay(field: RuleFieldSpec, stored: unknown): number | null {
  if (typeof stored !== 'number') return null;
  return field.scale ? round(stored / field.scale) : stored;
}

export function toStored(field: RuleFieldSpec, display: number): number {
  return field.scale ? round(display * field.scale) : display;
}

export function fieldError(field: RuleFieldSpec, display: number | null | undefined): string | null {
  if (display == null || Number.isNaN(display)) return `請填寫${field.label}`;
  if (field.integer && !Number.isInteger(display)) return `${field.label}必須是整數`;
  const belowMin = field.minExclusive ? display <= field.min : display < field.min;
  if (belowMin || display > field.max) {
    return `${field.label}須${field.minExclusive ? '大於' : '介於'} ${field.min}${field.minExclusive ? ' 且不超過 ' : '～'}${field.max}`;
  }
  return null;
}

function round(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}
