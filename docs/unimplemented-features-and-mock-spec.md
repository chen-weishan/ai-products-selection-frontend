# 團購選品策略系統 (SSDS) — 登入與驗證 (Auth/Login) 待實作功能與 Mock 規格書

本文件記錄目前系統中 **登入模組 (Login)、身分驗證 (Auth)、Mock 測試資料** 的現況與後續待補齊之功能清單。

---

## 一、 登入模組功能現況盤點

###  已完成功能 (Completed)
1. **Token 儲存機制**：登入成功後，`accessToken`、`refreshToken`、使用者基本資訊皆正確寫入 `localStorage`（Key: `ssds_access_Token`、`ssds_refresh_Token`、`ssds_user_info`）。
2. **HTTP 攔截器自動攜帶 Token**：`loginInterceptor` 已於 `appConfig` 全域生效，呼叫任何業務 API 時自動於 Request Header 加入 `Authorization: Bearer <accessToken>`。
3. **後端回應結構兼容器**：`AuthService.login()` 已支援多種後端回傳結構解析（含標準 Spring Boot / OAuth2 snake_case 與 camelCase）。
4. **Header 登出與身份標籤**：頂部 Header 已串接登出方法（一鍵清除 Token 導回登入頁），並動態顯示當前登入者姓名與角色標籤。
5. **登入錯誤碼解析**：支援 0 (連線中斷)、401 (帳密錯誤)、403 (帳號鎖定)、500 (伺服器異常) 等錯誤訊息友善化。

---

## 二、 待補齊之 Mock 測試帳號清單 (Mock Spec)

在 [mock-users.ts](file:///c:/Users/user/Documents/GitHub/ai-products-selection-frontend/src/app/core/auth/mock-users.ts) 中，需依據規格書補齊與調整以下項目：

### 1. 待補齊之測試帳號
* **新增第二位採購專員**：
  * Email：`buyer2@ssds.dev`
  * 密碼：`Ssds@2026`
  * 角色代碼：`BUYER`
  * 顯示姓名：`張佩琪`
  * 職稱說明：採購專員（日常品項評估）

* **新增/模擬停用帳號 (Disabled Account - 403 驗證)**：
  * Email：`disabled@ssds.dev`
  * 密碼：`Ssds@2026`
  * 預期行為：
    * 模擬模式下應回傳 **HTTP 403**。
    * 錯誤訊息應提示：「該帳號已被停用，請聯絡系統管理員」。
    * 前端不得發放 Token，不可進入主系統。

### 2. 現有 Mock 帳號姓名與規格書同步
需將現有 Mock 資料中的預設姓名調整為規格書統一版本：
| 帳號 Email | 角色代碼 (`RoleCode`) | 規格書指定姓名 | 目前 Mock 姓名 | 調整狀態 |
| :--- | :--- | :--- | :--- | :---: |
| `buyer@ssds.dev` | `BUYER` | **林采薇** | 王採購 | 待同步 |
| `buyer2@ssds.dev` | `BUYER` | **張佩琪** | *(無)* | 待新增 |
| `lead@ssds.dev` | `BUYER_LEAD` | **陳建豪** | 林主管 | 待同步 |
| `dataadmin@ssds.dev` | `DATA_ADMIN` | **黃詩涵** | 張資料 | 待同步 |
| `sysadmin@ssds.dev` | `SYS_ADMIN` | **王紹安** | 陳系統 | 待同步 |
| `viewer@ssds.dev` | `VIEWER` | **吳靜宜** | 趙觀察 | 待同步 |
| `disabled@ssds.dev` | `DISABLED` | **停用帳號** | *(無)* | 待新增 (回傳 403) |

---

## 三、 登入互動與使用者體驗待優化項目 (UX / Interaction)

### 1. 登入防護與重導向邏輯切換 (`LoginComponent.ngOnInit`)
* **現況**：目前為了方便開發階段能隨時開啟 `/login` 測試，將「若已登入則自動導向 `/dashboard`」的邏輯暫時註解。
* **待實作**：
  * 正式環境發布前需恢復此防護，或加入開發模式開關。
  * 支援未登入時記住原始存取路徑 (`returnUrl`)，登入完成後準確跳轉回原目標頁面。

### 2. 忘記密碼流程 (`/forget-password`)
* **現況**：目前路由 [app.routes.ts](file:///c:/Users/user/Documents/GitHub/ai-products-selection-frontend/src/app/app.routes.ts) 與組件已建立，但畫面仍為空殼。
* **待實作**：
  * 設計忘記密碼 UI（輸入註冊信箱、取得驗證碼）。
  * 串接後端重設密碼 API 或模擬發送重設信函。
  * 重設成功後的導頁通知。

---

## 四、 安全性與 HTTP 攔截器待補齊項目 (Security & Interceptor)

### 1. 403 Forbidden 全域錯誤彈窗提示
* **現況**：[error.interceptor.ts](file:///c:/Users/user/Documents/GitHub/ai-products-selection-frontend/src/app/core/http/error.interceptor.ts) 僅針對 401 Unauthorized 執行自動登出 (`logout()`)。
* **待實作**：
  * 攔截 403 Forbidden 錯誤（包括登入停用帳號、或業務 API 越權操作）。
  * 呼叫通知服務（如 MatSnackBar 或 Dialog）提示使用者：「您沒有權限執行此操作，或帳號已被停用」。

### 2. 無感 Token 刷新機制 (Silent Token Refresh)
* **現況**：雖然已從登入回應中存入 `refreshToken`，但尚未在攔截器中實作過期自動換發。
* **待實作**：
  * 當業務 API 發生 401 Token 過期時，先暫緩失敗請求。
  * 以 `refreshToken` 呼叫 `/api/v1/auth/refresh` 換取新的 `accessToken`。
  * 換發成功後重發原本的業務請求；若換發失敗則清空資料並導回登入頁。
