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
    email: 'buyer@ssds.dev',
    password: 'Ssds@2026',
    label: USER_ROLE_LABELS.BUYER,
    role: 'BUYER',
    description: '執行商品選品、尋源探索、趨勢追蹤與AI任務',
    user: {
      id: 'usr-001',
      username: 'buyer',
      name: '王採購 (Buyer)',
      role: 'BUYER',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=buyer'
    }
  },
  {
    email: 'lead@ssds.dev',
    password: 'Ssds@2026',
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
    email: 'dataadmin@ssds.dev',
    password: 'Ssds@2026',
    label: USER_ROLE_LABELS.DATA_ADMIN,
    role: 'DATA_ADMIN',
    description: '管理外部數據匯入、商品熱度標記與數據源維護',
    user: {
      id: 'usr-003',
      username: 'dataadmin',
      name: '張資料 (Data Admin)',
      role: 'DATA_ADMIN',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=dataadmin'
    }
  },
  {
    email: 'sysadmin@ssds.dev',
    password: 'Ssds@2026',
    label: USER_ROLE_LABELS.SYS_ADMIN,
    role: 'SYS_ADMIN',
    description: '具備全系統設定、使用者權限與全模組管理權限',
    user: {
      id: 'usr-004',
      username: 'sysadmin',
      name: '陳系統 (Sys Admin)',
      role: 'SYS_ADMIN',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=sysadmin'
    }
  },
  {
    email: 'viewer@ssds.dev',
    password: 'Ssds@2026',
    label: USER_ROLE_LABELS.VIEWER,
    role: 'VIEWER',
    description: '具備所有數據與報表之唯讀瀏覽權限，無法進行編輯變更',
    user: {
      id: 'usr-005',
      username: 'viewer',
      name: '趙觀察 (Viewer)',
      role: 'VIEWER',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=viewer'
    }
  }
];

export function findMockAccount(email: string, password?: string): MockAccount | undefined {
  const normalizedEmail = email.trim().toLowerCase();
  return MOCK_ACCOUNTS.find((acc) => {
    const emailMatch =
      acc.email.toLowerCase() === normalizedEmail ||
      (acc.user.username ? acc.user.username.toLowerCase() === normalizedEmail : false);
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
    accessToken: `eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiI0IiwiZW1haWwiOiJzeXNhZG1pbkBzc2RzLmRldiIsImRpc3BsYXlOYW1lIjoi546L57S55a6JIiwicm9sZXMiOlsiU1lTX0FETUlOIl0sImlhdCI6MTc4ODc2MzYyNywiZXhwIjoxNzg4NzcwODI3fQ.nYHjXMiQL_5BW1c1tfRcHUKhls7saWHeXLd1SjL1XMpHuJM_orVojPOtSuB9T4E4YC2Enk-DnHXVoWQd2XlsOw`,
    refreshToken: `mock_refresh_token_${account.user.id}_${timestamp}`,
    expiresIn: 86400, // 24 hours
    user: { ...account.user }
  };
}
