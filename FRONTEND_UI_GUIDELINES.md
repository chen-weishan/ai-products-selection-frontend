# 前端 UI 設計規範與標準元件手冊 (Design System & Guidelines)

> 本規範由專案團隊共同討論、實驗並在 `trends` 頁面驗證通過，作為全站前端頁面（如 `sourcing`、`sourcing-queue`、`trend-detail` 等）統整與未來新功能開發的統一標準。

---

## 目錄
1. [設計理念與核心維度](#1-設計理念與核心維度)
2. [全域版面骨架 (參照 `weights`)](#2-全域版面骨架-參照-weights)
   - [2.2 次級頁面頂部導航列 (`.top-nav-bar`)](#22-次級頁面頂部導航列-top-nav-bar---back-button-navigation)
   - [2.3 頁首標題列 (`.mh`)](#23-頁首標題列-mh---main-header)
   - [2.4 頁首與操作按鈕規格 (`.btn`)](#24-頁首與操作按鈕規格-btn---button-system)
   - [2.5 內容卡片 (`.card`)](#25-內容卡片-card)
3. [表單與控制項微互動 (Material + 特效)](#3-表單與控制項微互動-material--特效)
4. [狀態標籤規範 (Status Badges)](#4-狀態標籤規範-status-badges)
5. [業務與 AI 決策卡片與說明面板](#5-業務與-ai-決策卡片與說明面板)
   - [5.1 底部說明面板結構組成 (`.info-section`)](#51-結構組成)
   - [5.2 尋源探索與生命週期決策卡片 (`.card.scout-card`)](#52-尋源探索與生命週期決策卡片-cardscout-card--evaluation-grid)
   - [5.3 非同步 AI 任務與探索載入反饋 (`.header-meta.is-loading`)](#53-非同步-ai-任務與探索中載入反饋-header-metais-loading)
6. [程式碼範例與實作指南](#6-程式碼範例與實作指南)

---

## 1. 設計理念與核心維度

* **大框架模組化**：以 `weights` 的白底模組卡片與乾淨外圍邊距為基調，杜絕零碎的手寫 Padding。
* **觸控微回饋**：控制項加入物理質感的按壓反饋（Active Scale 0.95）與貝茲過渡動畫。
* **防重疊下拉選單**：全站下拉面板採用實色厚度灰底（Solid Background），徹底解決浮層透光穿透下方文字的痛點。
* **沉穩高級感配色**：狀態標籤採用莫蘭迪與牛血紅等實心深色，搭配白字，兼顧高可讀性與專業質感。
* **條理化業務說明**：比照 `heat-sources` 面板結構，將系統規則與 AI 演算法透明呈現給使用者。

---

## 2. 全域版面骨架 (參照 `weights`)

### 2.1 外層大底板 (`:host` / Page Container)
* **背景底色**：`#f8fafc`（冷調柔和淺灰，比純白更有層次）。
* **內距留白**：統一 `padding: 18px 20px 22px;`。
* **最小高度**：`min-height: calc(100vh - 64px);`。
* **字體系統**：
  ```scss
  --sans: 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif;
  --mono: 'IBM Plex Mono', ui-monospace, monospace;
  ```

### 2.2 次級頁面頂部導航列 (`.top-nav-bar` - Back Button Navigation)
適用於具備上一層清單之次級/詳情頁面（如 `heat-sources`、`trend-detail` 等）：
* **佈局原則**：獨立置於 `.mh` 主頁首上方，靠右對齊（`display: flex; justify-content: flex-end; margin-bottom: 12px;`）。
* **對齊標準**：垂直精準對齊下方 `.mh .tools` 中的主要操作按鈕（例如 `heat-sources` 的「新增來源」或 `trend-detail` 的「來源設定」上方）。
* **按鈕樣式**：使用次要按鈕 `.btn.back-btn`，文字固定為「返回列表」，避免混在主頁首工具列造成按鈕焦點混亂。
```html
<div class="top-nav-bar">
  <button type="button" class="btn back-btn" (click)="goBack()">
    返回列表
  </button>
</div>
```

### 2.3 頁首標題列 (`.mh` - Main Header)
* **佈局**：`display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;`。
* **左側標題**：
  * 主標題（`h3`）：`font-size: 18px; font-weight: 600; color: #0e2a3f;`。
  * 副標/狀態說明（`.sub`）：`font-size: 12px; color: #8a9aa6; margin-top: 2px;`。
* **右側工具列 (`.tools`)**：
  * 水平排列操作按鈕，間距固定 `gap: 8px;`，可容納次要與主要操作按鈕或版本切換選單。

### 2.4 頁首與操作按鈕規格 (`.btn` / Button System)
頁首右側與頁面通用的操作按鈕統一規格如下：

| 按鈕類型 | 類別名稱 (Class) | 外觀與樣式 | 適用時機 |
| :--- | :--- | :--- | :--- |
| **主要操作 (Primary)** | `.btn.pri` | 實心藍綠底（`#1e7a9e`）+ 白字，Hover 為 `#186380` | 「建立新版本」、「開始探索」、「儲存變更」等主行動 |
| **次要操作 (Secondary)** | `.btn` (預設) | 白底 + 灰細框（`#dce3e9`）+ 深灰字（`#4a5a67`），Hover 淺灰底 | 「重新整理」、「返回列表」、「取消」、「清除」 |
| **危險操作 (Danger)** | `.btn.danger` | 淺紅底 + 紅色邊框與文字（`#95190C`） | 「淘汰」、「刪除」、「撤銷」 |

#### 按鈕核心 SCSS 規範：
```scss
.btn {
  font-family: var(--sans);
  font-size: 12px;
  padding: 6px 14px;
  height: 34px; // 統一標準高度
  border-radius: 7px;
  border: 1px solid var(--line);
  background: #ffffff;
  color: var(--ink-2);
  cursor: pointer;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s cubic-bezier(0.19, 1, 0.22, 1);

  &:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
  }

  &:active {
    transform: scale(0.96); // 點擊微反饋
  }

  &.pri {
    background: var(--teal); // #1e7a9e
    border-color: var(--teal);
    color: #ffffff;
    font-weight: 500;

    &:hover {
      background: #186380;
    }
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}
```

### 2.5 內容卡片 (`.card`)
* **規格**：白底（`#ffffff`）、`border: 1px solid #dce3e9`、圓角 `9px`、柔和陰影 `box-shadow: 0 1px 3px rgba(0,0,0,0.04)`。
* 表格卡片（`.table-card`）內距設為 0，讓表格框線貼齊邊緣。

---

## 3. 表單與控制項微互動 (Material + 特效)

全面採用 **Angular Material**（`mat-form-field`、`matInput`、`mat-select`），統一設定 `appearance="outline"`。

### 3.1 尺寸與文字內距（防擁擠 Padding）
* **控制項高度**：統一 `height: 42px`。
* **容器外圍間距**：`.mat-mdc-form-field-flex { padding: 0 6px !important; }`。
* **文字左右間距**：
  * 輸入框文字：`padding: 0 8px !important;`。
  * 下拉選單文字：`padding: 0 8px !important;`。
* **浮動標籤（Label）**：`top: 21px !important; left: 6px !important; font-size: 12px;`。

### 3.2 物理回饋與貝茲動畫
```scss
.mat-mdc-text-field-wrapper {
  background-color: #f8fafc;
  border-radius: 8px;
  transition: all 0.3s cubic-bezier(0.19, 1, 0.22, 1);
  box-shadow: 0px 0px 20px -18px rgba(0, 0, 0, 0.5);
}

// Hover 時微升
&:hover .mat-mdc-text-field-wrapper {
  background-color: #f1f5f9;
  box-shadow: 0px 0px 20px -17px rgba(0, 0, 0, 0.6);
}

// Active 點擊按住時的 0.95 微縮放反饋
&:active .mat-mdc-text-field-wrapper {
  transform: scale(0.95);
}

// Focus 聚焦狀態
&.mat-focused .mat-mdc-text-field-wrapper {
  background-color: #ffffff;
}
```

### 3.3 全域防穿透下拉浮層 (`.unified-mat-select-panel` & `.mat-mdc-select-panel`)
在全域 `styles.scss` 定義，全站所有 `mat-select`（包含頂部篩選器以及分頁器的每頁筆數下拉）統一具備實色灰底：
* **面板背景**：`#f8fafc !important`（**實色不透明**，徹底解決預設透明穿透下方表格資料的痛點）。
* **邊框與陰影**：`border: 1px solid #cbd5e1 !important; border-radius: 8px !important;`，搭配多層深度立體陰影。
* **選項 Hover**：`background-color: #e2e8f0 !important;`。
* **選項 Selected**：`background-color: #e0f2fe !important; color: #0369a1 !important; font-weight: 600 !important;`。
* **分頁器支援**：`<mat-paginator>` 設定 `[selectConfig]="{ panelClass: 'unified-mat-select-panel' }"`，保證與業務下拉選單視覺完全統一。

### 3.5 數值與代碼強制等寬字型 (Monospace Alignment)
為避免多行數字因為字符寬度不一（如 `1` 較窄、`8` 較寬）導致縱向上下抖動，凡是 **純數字、百分比、斜率、權重、日期時間**，強制套用：
```scss
font-family: var(--mono); // 'IBM Plex Mono', monospace
```
讓表格與指標數據縱向對齊一致，呈現金融終端機等級的嚴謹度。

### 3.6 分段切換器 / 時間區間按鈕組 (`.range-tabs` / Segmented Control)
用於 30d/60d/90d 或日/週/月等單選切換場景：
* **底槽**：`background: #f1f5f9; padding: 3px; border-radius: 7px; display: flex; gap: 4px;`
* **切換按鈕 (`.range-btn`)**：
  * 平時：透明背景、深灰字、`font-size: 11.5px;`、點擊縮放 `active { transform: scale(0.95); }`。
  * 選中時（`.active`）：純白底 `#ffffff`、深海軍藍字、加粗、輕微陰影 `box-shadow: 0 1px 2px rgba(0,0,0,0.08)`。

### 3.7 分頁器規範 (Material Paginator)
放置於表格卡片底端（`<div class="card table-card">` 內），作為資料分頁與筆數切換元件：
* **佈局與框線**：白底、頂部細分隔線 `border-top: 1px solid var(--line-soft);`、`min-height: 52px;`，靠右對齊。
* **每頁筆數下拉選單 (`.mat-mdc-paginator-page-size-select`)**：
  * **文字充足內距**：`.mat-mdc-form-field-flex { padding: 0 8px 0 12px !important; }`，消除數字貼緊左側框線的擁擠感，給予呼吸空間。
  * **背景與圓角**：底色 `#f8fafc`、圓角 `8px`、細框線 `#cbd5e1`，並加入與頂部搜尋框一致之貝茲平滑過渡動畫與輕量陰影。
  * **微互動回饋**：Hover 時微升至 `#f1f5f9`，點擊按住 `:active` 時具備 `scale(0.95)` 物理反饋。
* **數值等寬字型**：頁碼筆數區間文字強制套用 `font-family: var(--mono);`，確保切換頁面時寬度不抖動。
* **換頁按鈕微互動**：按鈕在 `:active` 時套用 `transform: scale(0.92)` 點擊回饋。
* **在地化語系 (Traditional Chinese)**：使用自訂 `MatPaginatorIntl`，顯示「每頁筆數：」、「1 – 10 / 共 15 筆」、「下一頁」等清楚親切之中文標籤。

---

## 4. 狀態標籤規範 (Status Badges)

取消傳統容易顯得雜亂的外邊框（No Border），改採實色深色塊搭配純白字，具備現代感與極高對比度。

### 4.1 兩級尺寸分級 (Size Scale)
1. **標準/頁首級 (Default / Header Badge)**：
   用於頁首大標題旁，`font-size: 12px ~ 13px; font-weight: 600; padding: 3px 10px; border-radius: 6px;`。
2. **緊湊/表格級 (Compact / Inline Badge)**：
   用於表格儲存格或內文，`font-size: 11.5px; font-weight: 600; padding: 2px 8px; border-radius: 4px;`，避免撐開表格列高。

### 4.2 標準狀態配色表
| 狀態名稱 | 色號 (HEX) | 色彩命名 | 適用場景 |
| :--- | :--- | :--- | :--- |
| **常態 / 成功 (Normal)** | `#77B28C` | Muted Teal (莫蘭迪灰綠) | 數據正常、無風險、健康協同發展 |
| **警示 / 異常 (Warn)** | `#95190C` | Oxblood (牛血深紅) | AI 背離警示、高風險選品、淘汰建議 |
| **配額 / 提示 (Quota)** | `#d97706` | Amber (沉穩琥珀橘) | 待評估、需加急、配額不足 |

---

## 5. 業務與 AI 決策卡片與說明面板

放置在主數據表格下方，作為演算法邏輯、欄位名詞解釋、決策網格與使用者引導面板。

### 5.1 結構組成
1. **面板外框 (`.info-section`)**：
   - 白底、細邊框、`border-radius: 9px;`、`margin-top: 24px;`。
2. **面板標題列 (`.info-header`)**：
   - **純文字標題**：`<h4>`（14px 粗體深色），**不放圓形圖示、右上角不放演算法版本標籤**，保持畫面純粹極簡。
3. **說明網格小卡 (`.info-grid` & `.info-card`)**：
   - 響應式網格（`grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));`）。
   - 各小卡為獨立淺灰底（`#f8fafc`），純文字清晰標題，**不使用任何圓點裝飾**：
     - 熱度趨勢與均線斜率說明
     - AI 背離警示成因與選品風險
     - 常態發展與後續流程建議

### 5.2 尋源探索與生命週期決策卡片 (`.card.scout-card` & `.evaluation-grid`)
適用於 AI 尋源評估（`sourcing`）等決策頁面：
* **主報告卡片 (`.scout-card`)**：
  * 卡片頂部具備深海軍藍大標題與右側狀態/執行時間標籤。
  * 摘要區（`.report-summary`）採用淺灰底（`#f8fafc`）與等寬縮排呈現 AI 摘要。
  * 機會訊號（綠底 Check 標籤）與風險訊號（紅底 Warning 標籤）分流並列。
* **雙欄評估網格 (`.evaluation-grid`)**：
  * **時效落差評估卡片**：包含熱度階段、預估剩餘壽命、品類前置期，並以高亮警示框（`.gap-highlight-box`）呈現最終落差天數：
    * `> +14 天`：綠框（`.success`），判定為「可行，正常排序」。
    * `0 ～ +14 天`：黃橘框（`.warning`），判定為「高風險，標示需加速尋源」。
    * `< 0 天`：紅框（`.danger`），判定為「直接淘汰，不論熱度多高」。
  * **否決規則卡片**：條理列出時效落差硬性風控門檻。
* **底部操作按鈕列 (`.action-bar`)**：
  * 次要操作：`.btn`（「存為觀察」）。
  * 主要操作：`.btn.pri`（「加入尋源優先序」），若時效落差 `< 0 天` 則強制 `[disabled]` 鎖定。

### 5.3 非同步 AI 任務與探索中載入反饋 (`.header-meta.is-loading`)
當使用者發起 AI 探索但結果尚未產出時，卡片應提供清楚且具物理質感的即時反饋：
* **狀態文字與呼吸燈切換**：
  ```html
  <div class="header-meta" [class.is-loading]="isScouting()">
    {{ isScouting() ? '尋源中 請稍後' : '尚未進行探索' }}
  </div>
  ```
* **脈衝呼吸動畫 (Pulse Animation)**：
  ```scss
  .header-meta.is-loading {
    background: #e0f2fe;
    color: #0369a1;
    animation: pulse-loading 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  @keyframes pulse-loading {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.65; transform: scale(0.98); }
  }
  ```
* **引導區域動態文案**：
  * 探索中：`AI SourcingScoutAgent 正在全網檢索市場熱度與供應鏈數據，請稍後…`
  * 尚未探索：`請在上方輸入關鍵字並選擇品類，點擊「開始探索」以產出 AI 尋源評估報告。`

---

## 6. 程式碼範例與實作指南

### 6.1 HTML 結構範本
```html
<!-- 1. 頁首 -->
<div class="mh">
  <div>
    <h3>功能名稱 (English Title)</h3>
    <div class="sub">狀態數據 · 輔助說明</div>
  </div>
  <div class="tools">
    <button class="btn" (click)="reload()">重新整理</button>
  </div>
</div>

<!-- 2. 篩選工具列 -->
<div class="filter-bar">
  <mat-form-field appearance="outline" class="filter-field search-field" subscriptSizing="dynamic">
    <mat-label>搜尋欄位</mat-label>
    <input matInput placeholder="輸入文字…" [(ngModel)]="keyword" />
  </mat-form-field>

  <mat-form-field appearance="outline" class="filter-field select-field" subscriptSizing="dynamic">
    <mat-label>狀態篩選</mat-label>
    <mat-select [(ngModel)]="status" panelClass="unified-mat-select-panel">
      <mat-option value="ALL">全部狀態</mat-option>
      <mat-option value="NORMAL">常態</mat-option>
      <mat-option value="WARN">背離警示</mat-option>
    </mat-select>
  </mat-form-field>

  <button class="btn reset-filter-btn" [disabled]="isDefault()" (click)="reset()">
    清除條件
  </button>
</div>

<!-- 3. 主資料表格卡片 -->
<div class="card table-card">
  <table mat-table [dataSource]="list">
    <!-- 各欄位定義 -->
  </table>
</div>

<!-- 4. 底部說明面板 (純文字標題，無圖示、無右上標籤、無圓點) -->
<div class="info-section">
  <div class="info-header">
    <h4>業務與 AI 判讀規則說明</h4>
  </div>
  <div class="info-grid">
    <div class="info-card">
      <div class="card-head"><h5>項目說明</h5></div>
      <p>說明內文...</p>
    </div>
  </div>
</div>
```

---
*文件維護：前端研發團隊*  
*生效版本：v1.3 (已全數驗證於 `/trends`、`/trend-detail`、`/heat-sources`、`/sourcing`、`/sourcing-queue`)*
