import { LoginResponse, UserInfo, UserRole, USER_ROLE_LABELS } from '../models/auth-model';

export interface MockAccount {
  email: string;
  password: string;
  label: string;
  role: UserRole;
  description: string;
  user: UserInfo;
}

export const MOCK_ACCOUNTS: MockAccount[] = [
  {
    email: 'admin@company.com',
    password: 'admin123',
    label: USER_ROLE_LABELS.SYS_ADMIN,
    role: 'SYS_ADMIN',
    description: '具備全系統設定、使用者權限與全模組管理權限',
    user: {
      id: 'usr-001',
      username: 'admin',
      name: '陳系統 (Admin)',
      role: 'SYS_ADMIN',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin'
    }
  },
  {
    email: 'lead@company.com',
    password: 'lead123',
    label: USER_ROLE_LABELS.BUYER_LEAD,
    role: 'BUYER_LEAD',
    description: '負責選品決策審核、權重調配與團隊數據檢視',
    user: {
      id: 'usr-002',
      username: 'lead',
      name: '林主管 (Buyer Lead)',
      role: 'BUYER_LEAD',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=lead'
    }
  },
  {
    email: 'buyer@company.com',
    password: 'buyer123',
    label: USER_ROLE_LABELS.BUYER,
    role: 'BUYER',
    description: '執行商品選品、尋源探索、趨勢追蹤與AI任務',
    user: {
      id: 'usr-003',
      username: 'buyer',
      name: '王採購 (Buyer)',
      role: 'BUYER',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=buyer'
    }
  },
  {
    email: 'data@company.com',
    password: 'data123',
    label: USER_ROLE_LABELS.DATA_ADMIN,
    role: 'DATA_ADMIN',
    description: '管理外部數據匯入、商品熱度標記與數據源維護',
    user: {
      id: 'usr-004',
      username: 'data_admin',
      name: '張資料 (Data Admin)',
      role: 'DATA_ADMIN',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=data'
    }
  },
  {
    email: 'viewer@company.com',
    password: 'viewer123',
    label: USER_ROLE_LABELS.VIEWER,
    role: 'VIEWER',
    description: '僅供檢視報表與儀表板之唯讀權限',
    user: {
      id: 'usr-005',
      username: 'viewer',
      name: '李觀察 (Viewer)',
      role: 'VIEWER',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=viewer'
    }
  }
];

export function findMockAccount(email: string, password?: string): MockAccount | undefined {
  const normalizedEmail = email.trim().toLowerCase();
  return MOCK_ACCOUNTS.find(acc => {
    const emailMatch = acc.email.toLowerCase() === normalizedEmail || acc.user.username.toLowerCase() === normalizedEmail;
    if (!emailMatch) return false;
    if (password !== undefined) {
      return acc.password === password;
    }
    return true;
  });
}

export function createMockLoginResponse(account: MockAccount): LoginResponse {
  const timestamp = Date.now();
  return {
    accessToken: `eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiI0IiwiZW1haWwiOiJzeXNhZG1pbkBzc2RzLmRldiIsImRpc3BsYXlOYW1lIjoi546L57S55a6JIiwicm9sZXMiOlsiU1lTX0FETUlOIl0sImlhdCI6MTc4ODc1MzY0MSwiZXhwIjoxNzg4NzYwODQxfQ.YzlLRLp_TEHuTw9CBuoK601S1yjCBIh4x1ZMz7G-RHr8I0hOdzLYV7JmRXidwRLo_X61HUAJTKn_Hm0RGDZlnw`,
    refreshToken: `mock_refresh_token_${account.user.id}_${timestamp}`,
    expiresIn: 86400, // 24 hours
    user: { ...account.user }
  };
}
