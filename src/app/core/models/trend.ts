//改用generate 這個先放著
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

