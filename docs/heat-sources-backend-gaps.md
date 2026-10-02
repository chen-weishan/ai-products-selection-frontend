# Heat Sources 後端缺失與規則待對齊清單

檢視日期：2026-10-02。範圍：S-16／FR-14-2。本輪僅修改前端，未修改後端。

此文件依目前工作目錄的程式碼整理，未驗證實際部署環境、資料庫或外部帳號。

## 已存在的功能

- 熱度來源清單、管理員測試連線、啟用／停用採集、修改合成權重。
- Apify 帳號本月用量與上限查詢，在測試連線與採集流程中更新資料庫；查詢失敗沿用舊值。
- 權重變更後非同步重新合成與評分。
- 實際合成權重 `applied_weights` 已保存，趨勢明細已有對應資料；不是整個系統缺少權重快照。

## 需要後端補齊的功能

### 1. 自動健康檢查

規格 AC-14-6 要求每 15 分鐘更新可用性，但 `HeatSourceHealthCheckJob.java` 整份被註解。目前不能把來源狀態解讀為持續監控的即時結果。

建議：恢復或重新裁決健康檢查頻率，並提供排程是否啟用、最後執行時間。手動測試與採集更新可用性已存在，不應列為未實作。

依據：後端 `ssds-api/src/main/java/com/example/ssds/api/schedule/HeatSourceHealthCheckJob.java`。

### 2. 額度快照的新鮮度與取得結果

`HeatSourceDetailResponse` 只有 `quotaUsed`／`quotaLimit`。讀取失敗會保留舊值，但 API 未提供最後成功更新時間、最近查詢結果、計費週期或查詢失敗原因。`lastProbedAt` 不能直接當作額度成功更新時間。

建議：提供額度最後成功更新時間、最近查詢是否成功、計費期間；缺少上限需能區分「未提供」與「確定無上限」。

依據：後端 `ssds-api/src/main/java/com/example/ssds/api/heat/dto/HeatSourceDetailResponse.java`、`HeatSourceQuota.java`；`ssds-ingest/src/main/java/com/example/ssds/ingest/ApifyUsageProbe.java`。

### 3. 額度池／帳號識別

三個外部來源各自用設定的 Token 取得 Apify 帳號總用量。API 未提供安全的帳號或額度池識別，前端無法確定哪些來源共用額度，也無法把帳號總花費當作各來源獨立支出。

建議：提供不含 Token 的帳號／額度池識別與用量範圍。如果需要各來源成本，另提供來源級成本統計；目前帳號 Limits API 的數字不足以推算。

### 4. 非同步重算的持久化狀態與失敗復原

權重更新會發布事件並非同步重算。`HeatCompositionRecalculationListener` 捕捉例外後只記錄 log，沒有供前端查詢的任務 ID、執行狀態、完成結果或失敗重試入口。設定保存成功不代表重算已完成。

建議：將重算工作納入可追蹤任務，回傳任務 ID，提供執行中／成功／失敗狀態及具備防重複機制的重試能力。

依據：後端 `ssds-api/src/main/java/com/example/ssds/api/heat/HeatCompositionRecalculationListener.java`。

### 5. 來源可用性變更的稽核與通知

規格要求 AVAILABLE 轉為 UNAVAILABLE 時寫入稽核紀錄，並在 AI 任務中心提示。目前檢查的手動探測與採集流程會更新狀態，但未看到這些流程共同執行完整稽核／提示的處理。來源設定修改的稽核已存在，與可用性變更稽核是不同事件。

建議：集中處理可用性狀態轉換，涵蓋手動測試、採集失敗、額度耗盡、人工標記更新等入口，並避免重複通知。

依據：後端 `HeatSourceCommandService.java`、`ManualSourceHealthListener.java` 及 `ThreadsHeatIngestJob.java`／`GoogleTrendsHeatIngestJob.java`／`InstagramHeatIngestJob.java`。

### 6. 結構化診斷與來源描述

API 未提供完整狀態原因或目前實際採集供應者資訊。前端只能從失敗次數、額度與採集時間推測，無法辨識 Token 未設定、外部服務失敗、資料不足等具體原因。

建議：提供狀態原因代碼、最近錯誤摘要、實際採集供應者與資料新鮮度，避免前端長期維護固定對照。

## 規則差異：需裁決，不能直接當成未實作

| 項目 | 規格／前端原行為 | 目前後端行為 |
|---|---|---|
| 停用採集 | 前端原本排除合成 | `enabled` 只控制採集，舊讀值仍可能參與合成；本輪前端已對齊 |
| 權重生效時間 | 規格：次日 06:00 生效 | 權重修改後即非同步重算當日合成與評分 |
| 額度週期 | 規格：當日用量 | 實作取得 Apify 帳號本月用量 |
| 額度耗盡判定 | 規格：100% 為不可用 | 成功採集當下用滿先判降級；手動探測／下次採集前才判不可用 |
| S-16 頁面權限 | 規格路由表：SYS_ADMIN 專屬 | 所有登入者可讀，SYS_ADMIN 可寫；本輪保留現行唯讀權限 |

合成試算與實際權重應分開呈現。前端已補上品類級 0.5 折扣、明示試算限制並提供趨勢明細入口；不把目前設定比例冒充歷史評分的實際比例。
