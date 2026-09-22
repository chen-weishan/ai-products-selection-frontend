# 前端 UI 設計規範與標準元件手冊 (Design System & Guidelines)

> 本規範由專案團隊共同討論、實驗並在 `trends` 頁面驗證通過，作為全站前端頁面（如 `sourcing`、`sourcing-queue`、`trend-detail` 等）統整與未來新功能開發的統一標準。

---

## 目錄
1. [設計理念與核心維度](#1-設計理念與核心維度)
2. [全域版面骨架 (參照 `weights`)](#2-全域版面骨架-參照-weights)
3. [表單與控制項微互動 (Material + 特效)](#3-表單與控制項微互動-material--特效)
4. [狀態標籤規範 (Status Badges)](#4-狀態標籤規範-status-badges)
5. [底部業務與 AI 說明面板 (參照 `heat-sources`)](#5-底部業務與-ai-說明面板-參照-heat-sources)
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

### 2.2 頁首標題列 (`.mh` - Main Header)
* **佈局**：`display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;`。
* **左側標題**：
  * 主標題（`h3`）：`font-size: 18px; font-weight: 600; color: #0e2a3f;`。
  * 副標/狀態說明（`.sub`）：`font-size: 12px; color: #8a9aa6; margin-top: 2px;`。
* **右側工具列 (`.tools`)**：
  * 水平排列操作按鈕，間距固定 `gap: 8px;`，可容納次要與主要操作按鈕或版本切換選單。

### 2.3 頁首與操作按鈕規格 (`.btn` / Button System)
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

### 2.4 內容卡片 (`.card`)
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

## 5. 底部業務與 AI 說明面板 (參照 `heat-sources`)

放置在主數據表格下方，作為演算法邏輯、欄位名詞解釋與使用者引導面板。

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
*生效版本：v1.0 (已驗證於 `/trends`)*
