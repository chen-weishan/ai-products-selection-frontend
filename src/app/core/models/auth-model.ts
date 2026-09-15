export type UserRole = 'BUYER' | 'BUYER_LEAD' | 'DATA_ADMIN' | 'SYS_ADMIN' | 'VIEWER';

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  BUYER: '採購專員',
  BUYER_LEAD: '採購主管',
  DATA_ADMIN: '資料管理員',
  SYS_ADMIN: '系統管理員',
  VIEWER: '唯讀觀察者',
};

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UserInfo {
  email: string;
  displayName: string;
  roles: UserRole[];
}

export interface LoginResponse {
  accessToken: string;
  email: string;
  displayName: string;
  roles: UserRole[];
}
