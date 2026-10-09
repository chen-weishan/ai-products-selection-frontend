/**
 * S-14 排程：把 Spring 6 欄 cron（秒 分 時 日 月 週）與「頻率＋時間」的表單互轉。
 * 表單涵蓋不了的寫法（如一天兩個時段）落到 ADVANCED，仍可直接編輯 cron。
 */
export type ScheduleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ADVANCED';

export interface ScheduleForm {
  frequency: ScheduleFrequency;
  /** HH:mm */
  time: string;
  /** 1=週一 … 7=週日 */
  weekdays: number[];
  dayOfMonth: number;
  cron: string;
}

export const WEEKDAYS: { value: number; label: string; code: string }[] = [
  { value: 1, label: '週一', code: 'MON' },
  { value: 2, label: '週二', code: 'TUE' },
  { value: 3, label: '週三', code: 'WED' },
  { value: 4, label: '週四', code: 'THU' },
  { value: 5, label: '週五', code: 'FRI' },
  { value: 6, label: '週六', code: 'SAT' },
  { value: 7, label: '週日', code: 'SUN' },
];

const QUARTER_MONTHS = '1,4,7,10';

export function parseCron(cron: string): ScheduleForm {
  const normalized = (cron ?? '').trim().replace(/\s+/g, ' ');
  const advanced: ScheduleForm = { frequency: 'ADVANCED', time: '07:00', weekdays: [1], dayOfMonth: 1, cron: normalized };
  const parts = normalized.split(' ');
  if (parts.length !== 6) return advanced;
  const [second, minute, hour, dom, month, dow] = parts;
  if (second !== '0' || !isInt(minute, 0, 59) || !isInt(hour, 0, 23)) return advanced;
  const time = `${pad(Number(hour))}:${pad(Number(minute))}`;
  const base = { ...advanced, time };

  if (dom === '*' && month === '*' && (dow === '*' || dow === '?')) return { ...base, frequency: 'DAILY' };
  if ((dom === '*' || dom === '?') && month === '*') {
    const weekdays = parseWeekdays(dow);
    return weekdays == null ? advanced : { ...base, frequency: 'WEEKLY', weekdays };
  }
  if (isInt(dom, 1, 28) && (dow === '*' || dow === '?')) {
    if (month === '*') return { ...base, frequency: 'MONTHLY', dayOfMonth: Number(dom) };
    if (month === QUARTER_MONTHS) return { ...base, frequency: 'QUARTERLY', dayOfMonth: Number(dom) };
  }
  return advanced;
}

export function buildCron(form: ScheduleForm): string {
  if (form.frequency === 'ADVANCED') return form.cron.trim().replace(/\s+/g, ' ');
  const [hour, minute] = (form.time || '00:00').split(':').map(Number);
  const head = `0 ${minute} ${hour}`;
  switch (form.frequency) {
    case 'DAILY':
      return `${head} * * *`;
    case 'WEEKLY': {
      const days = [...new Set(form.weekdays)].sort((a, b) => a - b);
      return `${head} * * ${days.length === 7 ? '*' : weekdayField(days)}`;
    }
    case 'MONTHLY':
      return `${head} ${form.dayOfMonth} * *`;
    case 'QUARTERLY':
      return `${head} ${form.dayOfMonth} ${QUARTER_MONTHS} *`;
  }
}

/** 給人看的排程說明；看不懂的 cron 回 null，畫面改顯示原字串。 */
export function describeCron(cron: string): string | null {
  const form = parseCron(cron);
  switch (form.frequency) {
    case 'DAILY':
      return `每天 ${form.time}`;
    case 'WEEKLY':
      return `每${weekdayText(form.weekdays)} ${form.time}`;
    case 'MONTHLY':
      return `每月 ${form.dayOfMonth} 日 ${form.time}`;
    case 'QUARTERLY':
      return `每季首月（1、4、7、10 月）${form.dayOfMonth} 日 ${form.time}`;
    case 'ADVANCED':
      return describeMultiHour(form.cron);
  }
}

/** 處理「一天多個時段」這類表單不支援、但仍常見的寫法，例如季度校準的 0 0 8,9 1 1,4,7,10 *。 */
function describeMultiHour(cron: string): string | null {
  const parts = cron.split(' ');
  if (parts.length !== 6 || parts[0] !== '0' || !isInt(parts[1], 0, 59)) return null;
  const hours = parts[2].split(',');
  if (!hours.every((h) => isInt(h, 0, 23))) return null;
  const times = hours.map((h) => `${pad(Number(h))}:${pad(Number(parts[1]))}`).join('、');
  const single = parseCron(`0 ${parts[1]} ${hours[0]} ${parts[3]} ${parts[4]} ${parts[5]}`);
  if (single.frequency === 'ADVANCED') return null;
  const prefix = describeCron(buildCron(single))!;
  return prefix.replace(single.time, times);
}

/** 連續三天以上寫成範圍（TUE-SUN），其餘以逗號列出，與團隊既有 cron 寫法一致。 */
function weekdayField(days: number[]): string {
  const groups: number[][] = [];
  for (const day of days) {
    const last = groups[groups.length - 1];
    if (last && day === last[last.length - 1] + 1) last.push(day);
    else groups.push([day]);
  }
  return groups.map((group) => group.length >= 3
    ? `${WEEKDAYS[group[0] - 1].code}-${WEEKDAYS[group[group.length - 1] - 1].code}`
    : group.map((day) => WEEKDAYS[day - 1].code).join(',')).join(',');
}

/** 兩個 cron 在表單語意上是否相同（例如 TUE-SUN 與 TUE,WED,…,SUN）。 */
export function sameSchedule(a: string, b: string): boolean {
  return buildCron(parseCron(a)) === buildCron(parseCron(b));
}

function weekdayText(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 7) return '天';
  if (sorted.length === 5 && sorted.join() === '1,2,3,4,5') return '個工作日';
  const consecutive = sorted.length >= 3 && sorted.every((day, i) => i === 0 || day === sorted[i - 1] + 1);
  if (consecutive) return `${WEEKDAYS[sorted[0] - 1].label}至${WEEKDAYS[sorted[sorted.length - 1] - 1].label}`;
  return sorted.map((day) => WEEKDAYS[day - 1].label).join('、');
}

function parseWeekdays(field: string): number[] | null {
  const days = new Set<number>();
  for (const token of field.toUpperCase().split(',')) {
    const range = token.split('-');
    if (range.length > 2) return null;
    const start = weekdayValue(range[0]);
    const end = range.length === 2 ? weekdayValue(range[1]) : start;
    if (start == null || end == null) return null;
    if (start <= end) {
      for (let day = start; day <= end; day++) days.add(day);
    } else {
      // 跨週的範圍，例如 SAT-MON
      for (let day = start; day <= 7; day++) days.add(day);
      for (let day = 1; day <= end; day++) days.add(day);
    }
  }
  return days.size === 0 ? null : [...days].sort((a, b) => a - b);
}

function weekdayValue(token: string): number | null {
  const named = WEEKDAYS.find((day) => day.code === token);
  if (named) return named.value;
  if (!/^[0-7]$/.test(token)) return null;
  const value = Number(token);
  return value === 0 ? 7 : value;
}

function isInt(value: string, min: number, max: number): boolean {
  if (!/^\d{1,2}$/.test(value)) return false;
  const number = Number(value);
  return number >= min && number <= max;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
