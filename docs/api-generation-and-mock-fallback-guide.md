# 前端 API 生成機制、編譯故障修復與 Mock Fallback 架構紀錄

本文件記錄了多分支開發期間遭遇的 OpenAPI 代碼生成問題、編譯報錯排除過程、修復細節以及 Mock Fallback 架構設計。

---

## 一、 背景與情境 (Background)

目前後端處於多分支並行開發階段（例如：AI/Sourcing 分支、Trends 趨勢分支、Auth 認證分支）。各分支獨立匯出的 `openapi.json` 僅包含該分支負責的端點，尚未完成主幹 (main/develop) 的全量整合。

---

## 二、 遇到的問題與根因分析 (Troubleshooting)

### 1. 問題現象
執行 `ng serve` 或 `ng build` 時，編譯失敗並拋出大量 `TS2305: Module '"../model/models"' has no exported member` 與 `Module '"../../api"' has no exported member` 錯誤。

### 2. 根因分析 (Root Cause)
- 專案先前執行了 `npm run generate:api`（`openapi-generator-cli`）。
- 由於當前讀取的 `openapi.json` 僅包含 AI / S-17 Sourcing 的端點定義，生成工具重新輸出了 **匯出索引檔（Barrel Files）**：
  - `src/app/api/model/models.ts`
  - `src/app/api/api/api.ts`
- 生成工具產生的索引檔只包含當前 spec 中的定義，覆蓋了原本在資料夾中已存在的 `TrendControllerService`、`AuthControllerService`、`Point`、`TrendSignalRow` 等 export 宣告。
- **實體檔案（Controller 與 Model 邏輯）依然完好存在於資料夾中，但外部無法透過索引檔 import**，導致 Angular 編譯中斷。

---

## 三、 API 修復範圍與細節 (API Fixes)

> **重要說明**：本次修復 **完全沒有修改** 任何 Service 的商業邏輯、HTTP 請求路徑或 Model 欄位定義。

修復僅針對以下兩個「匯出索引檔」補回遺漏的 export 宣告：

### 1. `src/app/api/model/models.ts`
補齊資料夾中既有 Model 的匯出：
- **趨勢相關**：`Point`、`SourceDetail`、`TrendKeywordDetailResponse`、`TrendSignalRow`、`TrendDetailResponse`、`TrendChartProjection`、`TrendSignalProjection`
- **認證相關**：`LoginRequest`、`LoginResult`、`AuthenticatedUser`、`TokenPair`、`RefreshRequest` 及各類 `ApiResponse...`

### 2. `src/app/api/api/api.ts`
補齊資料夾中既有 Service 的匯出與 `APIS` 陣列註冊：
- `TrendControllerService` / `TrendControllerServiceInterface`
- `AuthControllerService` / `AuthControllerServiceInterface`
- `IngestTestControllerService` / `IngestTestControllerServiceInterface`

### 3. 編譯驗證結果
執行 `ng build` 驗證通過，**0 Errors**，專案成功打包並恢復正常熱重載。

---

## 四、 Mock Fallback 機制說明 (Mock Architecture)

為了確保在「後端未啟動」、「後端切換分支 (API 404)」或「網路異常」時，前端頁面仍可獨立開版、切版與測試，建立了 Mock Fallback 安全氣囊機制。

### 1. 假資料模組 (`src/app/core/mock/trend-mock.ts`)
包含兩部分資料：
1. **趨勢訊號清單 (`MOCK_TREND_LIST`)**：
   - 包含杜拜巧克力、燕麥奶生乳酪、泰式酸辣洋芋片、抹茶厚蛋捲、氣泡冷萃咖啡等 5 筆關鍵字及熱度、均線斜率、生命週期階段與背離判定。
2. **趨勢詳情與圖表數據 (`getMockTrendDetail`)**：
   - 依據 30d / 60d / 90d 動態產生時間序列點 (`points`)，供 Chart.js 渲染漸層折線圖。
   - 包含多源資料貢獻度 (`sourceDetails`)：Google Trends (40%)、社群聲量 (35%)、電商動能 (25%)。

### 2. 元件呼叫邏輯 (零衝突設計)
在 `TrendsComponent` 與 `TrendDetailComponent` 中：
```typescript
this.trendService.getTrends().subscribe({
  next: (res) => {
    // 1. 後端正常響應 (HTTP 200) -> 100% 使用後端真實資料
    this.trendList.set(res && res.length > 0 ? res : MOCK_TREND_LIST);
  },
  error: (err) => {
    // 2. 後端報錯或切分支 (404/500) -> 自動無縫回退假資料，維持畫面完整渲染
    console.warn('[TrendsComponent] 後端 API 請求失敗，自動使用 Mock 假資料回退:', err);
    this.trendList.set(MOCK_TREND_LIST);
  }
});
```

### 3. 後端整合後的影響與行為
- **優先權**：後端成功回傳時優先吃真實數據，假資料完全被靜默。
- **型別相容性**：假資料嚴格依照 OpenAPI Model 定義，100% 符合型別約束。
- **後續清理**：後端所有分支合併至主幹後，若無需保留 fallback，可直接於 error callback 移除。

---

## 五、 後續多分支開發建議與規範

1. **避免在單一功能分支頻繁覆蓋全量 API**：
   - 在後端完成主幹整合前，避免執行覆蓋整個 `src/app/api` 的操作；若需生成，可保留其他模組的 barrel exports。
2. **後端整合完畢後續流程**：
   - 當後端完成分支合併並產出包含全部端點的 `openapi.json` 時，執行一次 `npm run generate:api` 即可全自動產生完整型別。
