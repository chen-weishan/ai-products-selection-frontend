# 前端 UI 設計規範與標準元件手冊 (Design System & Guidelines)

> 本規範由專案團隊共同討論、實驗並在 `trends`、`dashboard`、`weights` 等核心頁面驗證通過，作為全站前端頁面（如 `sourcing`、`sourcing-queue`、`trend-detail`、`heat-sources` 等）統整與未來新功能開發的統一標準。任何 AI 助理或工程師切版時，皆須嚴格遵循本手冊之命名、尺寸、配色與架構。

---

## 目錄
1. [設計理念與核心維度](#1-設計理念與核心維度)
2. [全域版面骨架與設計代碼 (Tokens)](#2-全域版面骨架與設計代碼-tokens)
   - [2.1 外層大底板 (`:host`) 與全域變數清單](#21-外層大底板-host--page-container)
   - [2.2 次級頁面頂部導航列 (`.top-nav-bar`)](#22-次級頁面頂部導航列-top-nav-bar---back-button-navigation)
   - [2.3 頁首標題列 (`.mh`)](#23-頁首標題列-mh---main-header)
   - [2.4 按鈕系統規格 (`.btn`)](#24-按鈕系統規格-btn---button-system)
   - [2.5 內容卡片基底 (`.card`)](#25-內容卡片基底-card)
3. [表單與控制項微互動 (Material + 特效)](#3-表單與控制項微互動-material--特效)
   - [3.1 尺寸與文字內距 (防擁擠 Padding)](#31-尺寸與文字內距防擁擠-padding)
   - [3.2 物理回饋與貝茲動畫](#32-物理回饋與貝茲動畫)
   - [3.3 全域防穿透下拉浮層 (`.unified-mat-select-panel`)](#33-全域防穿透下拉浮層-unified-mat-select-panel--mat-mdc-select-panel)
   - [3.4 數值與代碼強制等寬字型 (Monospace Alignment)](#34-數值與代碼強制等寬字型-monospace-alignment)
   - [3.5 分段切換器 / 時間區間按鈕組 (`.range-tabs`)](#35-分段切換器--時間區間按鈕組-range-tabs--segmented-control)
   - [3.6 分頁器規範 (Material Paginator)](#36-分頁器規範-material-paginator)
4. [狀態標籤與評級方塊規範 (Badges & Chips)](#4-狀態標籤與評級方塊規範-badges--chips)
   - [4.1 兩級尺寸分級](#41-兩級尺寸分級-size-scale)
   - [4.2 標準狀態配色表](#42-標準狀態配色表)
   - [4.3 狀態標籤與評級方塊 SCSS 實作](#43-狀態標籤與評級方塊-scss-實作)
5. [業務與 AI 決策卡片與說明面板](#5-業務與-ai-決策卡片與說明面板)
   - [5.1 底部說明面板結構組成 (`.info-section`)](#51-底部說明面板結構組成-info-section)
   - [5.2 尋源探索與生命週期決策卡片 (`.card.scout-card`)](#52-尋源探索與生命週期決策卡片-cardscout-card--evaluation-grid)
   - [5.3 非同步 AI 任務與探索載入反饋 (`.header-meta.is-loading`)](#53-非同步-ai-任務與探索載入反饋-header-metais-loading)
6. [三大頁面原型範本 (Page Archetypes)](#6-三大頁面原型範本-page-archetypes)
   - [原型 A：列表與探索頁面 (List / Table Archetype)](#原型-a列表與探索頁面-list--table-archetype)
   - [原型 B：總覽與儀表板頁面 (Dashboard / Overview Archetype)](#原型-b總覽與儀表板頁面-dashboard--overview-archetype)
   - [原型 C：決策與詳情頁面 (Detail / Decision Archetype)](#原型-c決策與詳情頁面-detail--decision-archetype)
7. [Angular TypeScript 模組相依指南](#7-angular-typescript-模組相依指南)

---

## 1. 設計理念與核心維度

* **大框架模組化**：以白底模組卡片與乾淨外圍邊距為基調，杜絕零碎的手寫 Padding。
* **觸控微回饋**：控制項加入物理質感的按壓反饋（Active Scale 0.95 ~ 0.96）與貝茲過渡動畫。
* **防重疊下拉選單**：全站下拉面板採用實色厚度灰底（Solid Background `#f8fafc`），徹底解決浮層透光穿透下方文字的痛點。
* **沉穩高級感配色**：狀態標籤採用莫蘭迪灰綠（`#77B28C`）與牛血紅（`#95190C`）等實心深色，搭配白字，**取消外邊框（No Border）**，兼顧高可讀性與專業質感。
* **極簡條理化業務說明**：比照 `.info-section` 面板結構，**純文字標題、不放圖示、右上角不放版本標籤、小卡不放圓點裝飾**，透明呈現 AI 與演算法規則。

---

## 2. 全域版面骨架與設計代碼 (Tokens)

### 2.1 外層大底板 (`:host` / Page Container)
每個 Angular 頁面元件之 SCSS 根節點必須宣告完整的設計 Token：

```scss
:host {
  // 色彩語意 Token
  --navy: #123a56;
  --navy-deep: #0e2a3f;
  --teal: #1e7a9e;
  --teal-soft: #d8eaf2;
  --a: #77B28C;       // 莫蘭迪灰綠 (Normal / Success / Grade A)
  --b: #d97706;       // 沉穩琥珀橘 (Quota / Warning / Grade B)
  --c: #64748b;       // Slate 灰 (Default / Grade C)
  --risk: #95190C;    // 牛血深紅 (Danger / Divergence / High Risk)
  --warn: #d97706;    // 警示橘
  --card: #ffffff;
  --surface: #f8fafc;
  --ink: #16232e;
  --ink-2: #4a5a67;
  --ink-3: #8a9aa6;
  --line: #dce3e9;
  --line-soft: #eaeff3;

  // 字體系統
  --sans: 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif;
  --serif: 'Noto Serif TC', 'Songti TC', serif;
  --mono: 'IBM Plex Mono', ui-monospace, monospace;

  // 容器佈局規格
  display: block;
  font-family: var(--sans);
  color: var(--ink);
  line-height: 1.6;
  padding: 18px 20px 22px;
  background: var(--surface);
  min-height: calc(100vh - 64px);
}
```

### 2.2 次級頁面頂部導航列 (`.top-nav-bar` - Back Button Navigation)
適用於具備上一層清單之次級/詳情頁面（如 `heat-sources`、`trend-detail` 等）：
* **佈局原則**：獨立置於 `.mh` 主頁首上方，靠右對齊（`display: flex; justify-content: flex-end; margin-bottom: 12px;`）。
* **按鈕樣式**：使用次要按鈕 `.btn.back-btn`，文字固定為「返回列表」。

```html
<div class="top-nav-bar">
  <button type="button" class="btn back-btn" (click)="goBack()">
    返回列表
  </button>
</div>
```

### 2.3 頁首標題列 (`.mh` - Main Header)
* **佈局**：`display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;`。
* **左側標題**：
  * 主標題（`h3`）：`font-family: var(--serif); font-size: 18px; font-weight: 600; color: var(--navy-deep); margin: 0;`。
  * 副標/狀態說明（`.sub`）：`font-size: 12px; color: var(--ink-3); margin-top: 2px;`。
* **右側工具列 (`.tools`)**：
  * 水平排列操作按鈕，間距固定 `gap: 8px;`，可容納分段切換器、次要按鈕與主要操作按鈕。

### 2.4 按鈕系統規格 (`.btn` / Button System)
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
    background: var(--teal);
    border-color: var(--teal);
    color: #ffffff;
    font-weight: 500;

    &:hover {
      background: #186380;
    }
  }

  &.danger {
    background: #fef2f2;
    border-color: #fecaca;
    color: var(--risk);

    &:hover {
      background: #fee2e2;
    }
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}
```

### 2.5 內容卡片基底 (`.card`)
* **規格**：白底（`#ffffff`）、`border: 1px solid #dce3e9`、圓角 `9px`、柔和陰影 `box-shadow: 0 1px 3px rgba(0,0,0,0.04)`、`overflow: hidden;`。
* **表格卡片 (`.table-card`)**：內距設為 0（`padding: 0;`），讓表格框線貼齊邊緣。
* **KPI 彙總卡片 (`.kpi-card`)**：內距 `14px 16px`，數值強制使用等寬字型 `font-family: var(--mono); font-size: 26px; font-weight: 700;`。

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
全站所有 `mat-select`（包含頂部篩選器以及分頁器的每頁筆數下拉）統一具備實色灰底：
* **面板背景**：`#f8fafc !important`（**實色不透明**，徹底解決預設透明穿透下方表格資料的痛點）。
* **邊框與陰影**：`border: 1px solid #cbd5e1 !important; border-radius: 8px !important;`，搭配多層深度立體陰影。
* **選項 Hover**：`background-color: #e2e8f0 !important;`。
* **選項 Selected**：`background-color: #e0f2fe !important; color: #0369a1 !important; font-weight: 600 !important;`。
* **分頁器支援**：`<mat-paginator>` 設定 `[selectConfig]="{ panelClass: 'unified-mat-select-panel' }"`。

### 3.4 數值與代碼強制等寬字型 (Monospace Alignment)
為避免多行數字因為字符寬度不一（如 `1` 較窄、`8` 較寬）導致縱向上下抖動，凡是 **純數字、百分比、斜率、權重、日期時間、序號、KPI 統計**，強制套用：
```scss
.mono {
  font-family: var(--mono); // 'IBM Plex Mono', monospace
}
```

### 3.5 分段切換器 / 時間區間按鈕組 (`.range-tabs` / Segmented Control)
用於 A/B 軌切換、榜單切換、30d/60d/90d 或日/週/月等單選切換場景。

#### HTML 結構：
```html
<div class="range-tabs">
  <button type="button" class="range-btn" [class.active]="selectedTab === 'A'" (click)="selectTab('A')">
    A 軌 有供應商
  </button>
  <button type="button" class="range-btn" [class.active]="selectedTab === 'B'" (click)="selectTab('B')">
    B 軌 尋源中
  </button>
</div>
```

#### 標準 SCSS 實作：
```scss
.range-tabs {
  display: inline-flex;
  background: #f1f5f9;
  padding: 3px;
  border-radius: 7px;
  gap: 4px;

  .range-btn {
    border: none;
    background: transparent;
    font-family: var(--sans);
    font-size: 11.5px;
    color: var(--ink-2);
    padding: 5px 12px;
    border-radius: 5px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s cubic-bezier(0.19, 1, 0.22, 1);

    &:hover {
      color: var(--ink);
    }

    &:active {
      transform: scale(0.95);
    }

    &.active {
      background: #ffffff;
      color: var(--navy-deep);
      font-weight: 600;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }
  }
}
```

### 3.6 分頁器規範 (Material Paginator)
放置於表格卡片底端（`<div class="card table-card">` 內），作為資料分頁與筆數切換元件：
* **佈局與框線**：白底、頂部細分隔線 `border-top: 1px solid var(--line-soft);`、`min-height: 52px;`，靠右對齊。
* **在地化語系 (Traditional Chinese)**：使用自訂 `MatPaginatorIntl`，顯示「每頁筆數：」、「1 – 10 / 共 15 筆」、「下一頁」等中文標籤。

---

## 4. 狀態標籤與評級方塊規範 (Badges & Chips)

**取消傳統容易顯得雜亂的外邊框（No Border）**，改採實色深色塊搭配純白字，具備現代感與極高對比度。

### 4.1 兩級尺寸分級 (Size Scale)
1. **標準/頁首級 (`.status-badge`)**：
   用於頁首大標題旁，`font-size: 12px ~ 13px; font-weight: 600; padding: 3px 10px; border-radius: 6px;`。
2. **緊湊/表格級 (`.status-badge.compact`)**：
   用於表格儲存格或內文，`font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 4px;`，避免撐開表格列高。

### 4.2 標準狀態配色表
| 狀態名稱 | 色號 (HEX) | 色彩命名 | 適用場景 |
| :--- | :--- | :--- | :--- |
| **常態 / 成功 (Normal)** | `#77B28C` | Muted Teal (莫蘭迪灰綠) | 數據正常、無風險、健康協同發展、時效落差足夠 |
| **警示 / 異常 (Warn)** | `#95190C` | Oxblood (牛血深紅) | AI 背離警示、高風險選品、淘汰建議、已逾期 |
| **配額 / 提示 (Quota)** | `#d97706` | Amber (沉穩琥珀橘) | 待評估、需加急、配額不足、中風險 |
| **覆寫 / 次要 (Override)** | `#64748b` | Slate (板岩灰) | 人工覆寫情境標記、次要備註 |

### 4.3 狀態標籤與評級方塊 SCSS 實作

```scss
// 狀態標籤
.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 6px;
  color: #ffffff;
  white-space: nowrap;

  &.compact {
    font-size: 11px;
    padding: 2px 7px;
    border-radius: 4px;
  }

  &.status-normal { background: var(--a); } // #77B28C
  &.status-warn   { background: var(--risk); } // #95190C
  &.status-quota  { background: var(--warn); } // #d97706
  &.override-badge { background: var(--c); } // #64748b
}

// 評級方塊 (A/B/C Grade Chips)
.grade-chip {
  font-family: var(--serif);
  font-size: 11px;
  font-weight: 700;
  width: 22px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: #ffffff;

  &.grade-a { background: var(--a); }
  &.grade-b { background: var(--b); }
  &.grade-c { background: var(--c); }
}
```

---

## 5. 業務與 AI 決策卡片與說明面板

放置在主數據表格或主圖表下方，作為演算法邏輯、欄位名詞解釋、決策網格與使用者引導面板。

### 5.1 底部說明面板結構組成 (`.info-section`)
1. **面板外框 (`.info-section`)**：白底、細邊框、`border-radius: 9px;`、`margin-top: 24px;`、`box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);`。
2. **面板標題列 (`.info-header`)**：
   - **純文字標題**：`<h4>`（14px 粗體深色），**不放圓形圖示、右上角不放演算法版本標籤**，保持畫面純粹極簡。
3. **說明網格小卡 (`.info-grid` & `.info-card`)**：
   - 響應式網格（`grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;`）。
   - 各小卡為獨立淺灰底（`#f8fafc`），純文字清晰標題，**不使用任何圓點裝飾**。

#### 標準 SCSS 實作：
```scss
.info-section {
  margin-top: 24px;
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 18px 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

  .info-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--line-soft);
    padding-bottom: 12px;
    margin-bottom: 16px;

    .info-title h4 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--navy-deep);
    }
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 16px;
  }

  .info-card {
    background: #f8fafc;
    border: 1px solid var(--line-soft);
    border-radius: 8px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;

    .card-head h5 {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      color: var(--navy-deep);
    }

    p {
      margin: 0;
      font-size: 12px;
      color: var(--ink-2);
      line-height: 1.6;

      strong {
        color: var(--navy);
      }
    }
  }
}
```

### 5.2 尋源探索與生命週期決策卡片 (`.card.scout-card` & `.evaluation-grid`)
適用於 AI 尋源評估（`sourcing`）等決策頁面：
* **時效落差評估卡片**：包含熱度階段、預估剩餘壽命、品類前置期，並以高亮警示框（`.gap-highlight-box`）呈現最終落差天數：
  * `> +14 天`：綠框（`.success`），判定為「可行，正常排序」。
  * `0 ～ +14 天`：黃橘框（`.warning`），判定為「高風險，標示需加速尋源」。
  * `< 0 天`：紅框（`.danger`），判定為「直接淘汰，不論熱度多高」。
* **底部操作按鈕列 (`.action-bar`)**：
  * 次要操作：`.btn`（「存為觀察」）。
  * 主要操作：`.btn.pri`（「加入尋源優先序」），若時效落差 `< 0 天` 則強制 `[disabled]` 鎖定。

### 5.3 非同步 AI 任務與探索載入反饋 (`.header-meta.is-loading`)
當使用者發起 AI 探索但結果尚未產出時，卡片應提供清楚且具物理質感的即時反饋：
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

---

## 6. 三大頁面原型範本 (Page Archetypes)

任何新頁面開發，請先確認所屬之原型類別，並嚴格按照對應的 HTML 範本結構切版：

### 原型 A：列表與探索頁面 (List / Table Archetype)
> **適用範例**：`trends`、`sourcing-queue`、`product-list`

```html
<!-- 1. 頁首 -->
<div class="mh">
  <div>
    <h3>功能名稱 (English Title)</h3>
    <div class="sub">狀態數據 · 輔助說明</div>
  </div>
  <div class="tools">
    <button type="button" class="btn" (click)="reload()">重新整理</button>
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

  <button type="button" class="btn reset-filter-btn" [disabled]="isDefault()" (click)="reset()">
    清除條件
  </button>
</div>

<!-- 3. 主資料表格卡片 -->
<div class="card table-card">
  <table mat-table [dataSource]="list">
    <!-- 各欄位定義 -->
  </table>
  <mat-paginator [length]="totalCount" [pageSize]="10" [selectConfig]="{ panelClass: 'unified-mat-select-panel' }"></mat-paginator>
</div>

<!-- 4. 底部說明面板 -->
<div class="info-section">
  <div class="info-header">
    <div class="info-title"><h4>業務與 AI 判讀規則說明</h4></div>
  </div>
  <div class="info-grid">
    <div class="info-card">
      <div class="card-head"><h5>規則項目</h5></div>
      <p>規則說明內容...</p>
    </div>
  </div>
</div>
```

---

### 原型 B：總覽與儀表板頁面 (Dashboard / Overview Archetype)
> **適用範例**：`dashboard`、`admin`

```html
<!-- 1. 頁首與切換器 -->
<div class="mh">
  <div>
    <h3>總覽看板標題</h3>
    <div class="sub">統計週期與版本資訊</div>
  </div>
  <div class="tools">
    <div class="range-tabs">
      <button type="button" class="range-btn" [class.active]="activeTab === 'A'" (click)="switchTab('A')">A 模式</button>
      <button type="button" class="range-btn" [class.active]="activeTab === 'B'" (click)="switchTab('B')">B 模式</button>
    </div>
    <button type="button" class="btn" (click)="reload()">重新整理</button>
    <button type="button" class="btn pri" (click)="primaryAction()">主要操作</button>
  </div>
</div>

<!-- 2. 全域 KPI 統計卡片網格 -->
<div class="section-title">全域彙總 KPI</div>
<div class="kpis">
  <div class="card kpi-card">
    <div class="v mono">128</div>
    <div class="l">主要指標</div>
    <div class="delta mono">＋12 本週新增</div>
  </div>
  <div class="card kpi-card alert">
    <div class="v mono">3</div>
    <div class="l">高風險示警</div>
    <div class="sub-hint risk-hint">需即時介入處理</div>
  </div>
</div>

<!-- 3. 排行榜 / 核心資料表格 -->
<div class="card table-card">
  <table class="ranking-table">
    <!-- 表格內容 -->
  </table>
</div>

<!-- 4. 底部雙欄待辦 / 延伸模組 -->
<div class="dual-section">
  <div class="card op-card">...</div>
  <div class="card op-card">...</div>
</div>

<!-- 5. 底部說明面板 -->
<div class="info-section">...</div>
```

---

### 原型 C：決策與詳情頁面 (Detail / Decision Archetype)
> **適用範例**：`trend-detail`、`sourcing`、`weights`

```html
<!-- 1. 頂部返回導航列 (靠右對齊) -->
<div class="top-nav-bar">
  <button type="button" class="btn back-btn" (click)="goBack()">返回列表</button>
</div>

<!-- 2. 主頁首 (標題 + 狀態標籤) -->
<div class="mh">
  <div>
    <div style="display:flex;align-items:center;gap:8px">
      <h3>項目名稱詳情分析</h3>
      <span class="status-badge status-normal">健康度良好</span>
    </div>
    <div class="sub">最後更新日期：2026-09-23</div>
  </div>
  <div class="tools">
    <button type="button" class="btn pri" (click)="save()">儲存決策</button>
  </div>
</div>

<!-- 3. 核心大圖表卡片 / 探索評估卡片 -->
<div class="card chart-card">
  <div class="card-header-bar">
    <h4>趨勢走勢圖表</h4>
    <div class="range-tabs">
      <button type="button" class="range-btn active">30 天</button>
      <button type="button" class="range-btn">90 天</button>
    </div>
  </div>
  <!-- 圖表或評估內容 -->
</div>

<!-- 4. 底部說明面板 -->
<div class="info-section">...</div>
```

---

## 7. Angular TypeScript 模組相依指南

使用 Angular 17+ Standalone Components 時，請確認元件之 `@Component.imports` 具備必要的模組：

```typescript
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

// Angular Material 模組 (依需求引入)
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';

@Component({
  selector: 'app-example',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatPaginatorModule
  ],
  templateUrl: './example.component.html',
  styleUrl: './example.component.scss'
})
export class ExampleComponent {}
```

---
*文件維護：前端研發團隊*  
*生效版本：v2.0 (全數驗證於 `/trends`、`/trend-detail`、`/heat-sources`、`/sourcing`、`/sourcing-queue`、`/dashboard`、`/weights`)*
