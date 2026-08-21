export type UserRole =

  | 'BUYER'        // 採購專員

  | 'BUYER_LEAD'   // 採購主管

  | 'DATA_ADMIN'   // 資料管理員

  | 'SYS_ADMIN'    // 系統管理員

  | 'VIEWER';      // 唯讀觀察者


export const USER_ROLE_LABELS: Record<UserRole, string> = {

  BUYER: '採購專員',

  BUYER_LEAD: '採購主管',

  DATA_ADMIN: '資料管理員',

  SYS_ADMIN: '系統管理員',

  VIEWER: '唯讀觀察者'

};

export interface LoginRequest {

  email:string;

  password:string;

}

export interface UserInfo {

  id: string | number;

  username: string;

  name: string;

  role: UserRole; // 權限區分

  avatarUrl?: string;

}

export interface LoginResponse {
  accessToken: string; // 訪問token

  refreshToken?: string; // 刷新token

  expiresIn?: number; //token有效時間

  user: UserInfo;//用戶權限
}
