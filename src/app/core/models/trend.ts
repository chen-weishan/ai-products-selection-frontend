export interface Point {
    date?: string;
    compositeValue?: number;
}

export interface SourceDetail {
    sourceName?: string;
    slope7d?: number;
    slope30d?: number;
    percentile?: number;
    appliedWeight?: number;
    status?: string;
}

export interface TrendSignalRow {
    keywordId?: number;
    keyword?: string;
    heatToday?: number;
    slope7d?: number;
    slope30d?: number;
    stage?: string;
    divergenceFlag?: boolean;
}

export interface TrendKeywordDetailResponse extends TrendSignalRow {
    points?: Point[];
    stageWeeks?: number;
    estimatedLifespanDays?: number;
    sourceDetails?: SourceDetail[];
}

export interface TrendChartPoint {
    "date": string;
    "heatScore": number;
}
export interface TrendDetailResponse {
    "heatToday": number;
    "keyword": string;
    "slope30d": number;
    "slope7d": number;
    "sourceDetails": TrendSourceDetail[];
}

export interface TrendSourceDetail {
    "actualWeight": number;
    "percentile": number;
    "slope30d": number;
    "slope7d": number;
    "sourceName": string;
    "status": string;
}

export interface TrendListItem {
    "keywordId": number;
    "keyword": string;
    "heatToday": number;
    "slope7d": number;
    "slope30d": number;
    "aiSignal": string;
}

