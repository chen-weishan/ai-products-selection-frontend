import { TrendKeywordDetailResponse, TrendSignalRow } from '../../api';

export const MOCK_TREND_LIST: TrendSignalRow[] = [
  {
    keywordId: 1,
    keyword: '杜拜巧克力',
    heatToday: 88,
    slope7d: 1.45,
    slope30d: 2.15,
    stage: 'PLATEAU',
    divergenceFlag: true,
  },
  {
    keywordId: 2,
    keyword: '燕麥奶生乳酪',
    heatToday: 76,
    slope7d: 0.85,
    slope30d: 1.12,
    stage: 'RISING',
    divergenceFlag: false,
  },
  {
    keywordId: 3,
    keyword: '泰式酸辣洋芋片',
    heatToday: 65,
    slope7d: 0.32,
    slope30d: 0.58,
    stage: 'RISING',
    divergenceFlag: false,
  },
  {
    keywordId: 4,
    keyword: '抹茶厚蛋捲',
    heatToday: 42,
    slope7d: -0.21,
    slope30d: 0.15,
    stage: 'PLATEAU',
    divergenceFlag: false,
  },
  {
    keywordId: 5,
    keyword: '氣泡冷萃咖啡',
    heatToday: 30,
    slope7d: -0.75,
    slope30d: -0.42,
    stage: 'DECLINING',
    divergenceFlag: true,
  },
];

export function getMockTrendDetail(
  keywordId: number,
  range: '90d' | '60d' | '30d' = '90d'
): TrendKeywordDetailResponse {
  const days = range === '30d' ? 30 : range === '60d' ? 60 : 90;
  const matched = MOCK_TREND_LIST.find((t) => t.keywordId === keywordId);
  const keyword = matched?.keyword ?? '杜拜巧克力(代工)';

  const points = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
    // 生成波動曲線
    const baseValue = matched?.heatToday ?? 80;
    const wave = Math.sin((days - i) / 5) * 12 + ((days - i) / days) * 15;
    const value = Math.max(10, Math.min(100, Math.round(baseValue - (days - i) * 0.1 + wave)));
    points.push({
      date: dateStr,
      compositeValue: value,
    });
  }

  return {
    keywordId,
    keyword,
    points,
    heatToday: matched?.heatToday ?? 88,
    slope7d: matched?.slope7d ?? 1.45,
    slope30d: matched?.slope30d ?? 2.15,
    stage: matched?.stage ?? 'PLATEAU',
    stageWeeks: 3,
    estimatedLifespanDays: 35,
    divergenceFlag: matched?.divergenceFlag ?? true,
    sourceDetails: [
      {
        sourceName: 'Threads',
        slope7d: 3.4,
        slope30d: 11.2,
        slope7dDisplay: '+340%',
        slope30dDisplay: '+1120%',
        percentile: 95,
        appliedWeight: 0.4,
        status: 'AVAILABLE',
      },
      {
        sourceName: 'Google',
        subName: 'Trends',
        slope7d: 0.86,
        slope30d: 4.1,
        slope7dDisplay: '+86%',
        slope30dDisplay: '+410%',
        percentile: 85,
        appliedWeight: 0.25,
        status: 'AVAILABLE',
      },
      {
        sourceName: 'Instagram',
        subName: '(品類)',
        slope7d: 0.04,
        slope30d: 0.62,
        slope7dDisplay: '+4%',
        slope30dDisplay: '+62%',
        percentile: 50,
        appliedWeight: 0.1,
        status: 'INSUFFICIENT_QUOTA',
        isMuted: true,
      },
      {
        sourceName: 'Dcard',
        subName: '(論壇)',
        slope7d: -0.15,
        slope30d: -0.05,
        slope7dDisplay: '-15%',
        slope30dDisplay: '-5%',
        percentile: 30,
        appliedWeight: 0.1,
        status: 'DEGRADED',
        isMuted: true,
      },
      {
        sourceName: '人工標記',
        badge: '8 人次',
        slope7d: 4.8,
        slope30d: 4.8,
        slope7dDisplay: '4.1 →\n4.8',
        slope30dDisplay: '2.6 →\n4.8',
        percentile: 90,
        appliedWeight: 0.25,
        status: 'AVAILABLE',
        isManual: true,
      },
    ] as any,
  };
}
