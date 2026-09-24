/**
 * FR-17 節慶檔期與氣候基準（S-20）。欄位與後端 ssds-api 的 DTO 一一對應。
 */

import { ApiResponse } from './weight';

export type { ApiResponse };

/** 曆別。後端 CalendarType。 */
export type CalendarType = 'LUNAR' | 'SOLAR';

/**
 * 清單的狀態欄。後端 FestivalWindowStatus。
 *
 * 取該節慶所有關聯品類中「時間窗權重最高者」：只要有任何一個品類進入黃金備貨期，
 * 這個檔期對採購就是「該動了」。
 */
export type FestivalWindowStatus = 'NOT_STARTED' | 'IN_WINDOW' | 'SUPPLEMENTARY' | 'PASSED';

export const WINDOW_STATUS_LABELS: Record<FestivalWindowStatus, string> = {
  NOT_STARTED: '未開始',
  IN_WINDOW: '窗內',
  SUPPLEMENTARY: '補單期',
  PASSED: '已過',
};

export const CALENDAR_TYPE_LABELS: Record<CalendarType, string> = {
  LUNAR: '農曆',
  SOLAR: '國曆',
};

export interface Festival {
  id: number;
  festivalCode: string;
  festivalName: string;
  calendarType: CalendarType;
  /** 國曆日期。LUNAR 檔期由後端換算產生（AC-17-1），前端不可讓使用者直接輸入。 */
  festivalDate: string;
  year: number;
  relatedCategoryCount: number;
  windowStatus: FestivalWindowStatus;
}

/** 品項表單的下拉選項。GET /festivals 不帶 year 時的回應。 */
export interface FestivalOption {
  festivalCode: string;
  festivalName: string;
}

export interface FestivalCreateRequest {
  festivalCode: string;
  festivalName: string;
  calendarType: CalendarType;
  year: number;
  /** SOLAR 必填 */
  festivalDate?: string | null;
  /** LUNAR 必填 */
  lunarMonth?: number | null;
  /** LUNAR 必填 */
  lunarDay?: number | null;
}

export interface FestivalUpdateRequest {
  festivalName: string;
  festivalDate?: string | null;
  lunarMonth?: number | null;
  lunarDay?: number | null;
}

export interface CategoryLeadTime {
  categoryId: number;
  categoryName: string;
  leadTimeDays: number;
}

export interface CategoryClimateProfile {
  categoryId: number;
  categoryName: string;
  idealTempMin: number;
  idealTempMax: number;
  tolerance: number;
}

export interface ClimateNormal {
  regionCode: string;
  month: number;
  avgTemp: number;
  rainProbability: number;
}

/**
 * GET /categories/profiles 的一列：品類 + 兩張設定表的現值。
 *
 * 尚未設定的欄位是 null，不是 0——AC-17-5 的判準是「有沒有資料」，
 * 用 0 代替會讓「適溫 0°C」與「沒填」變成同一件事。
 */
export interface CategoryProfile {
  categoryId: number;
  categoryName: string;
  leadTimeDays: number | null;
  idealTempMin: number | null;
  idealTempMax: number | null;
  tolerance: number | null;
}
