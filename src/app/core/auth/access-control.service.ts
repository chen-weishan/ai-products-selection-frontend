import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { UserRole } from '../models/auth-model';
import { AuthService } from './auth.service';
import { BasicAuthService } from './basic-auth.service';

const DEV_BASIC_AUTH_ROLES: Readonly<Record<string, UserRole>> = {
  'buyer@ssds.dev': 'BUYER',
  'buyer2@ssds.dev': 'BUYER',
  'lead@ssds.dev': 'BUYER_LEAD',
  'dataadmin@ssds.dev': 'DATA_ADMIN',
  'sysadmin@ssds.dev': 'SYS_ADMIN',
  'viewer@ssds.dev': 'VIEWER',
};

@Injectable({ providedIn: 'root' })
export class AccessControlService {
  private readonly basicAuth = inject(BasicAuthService);
  private readonly auth = inject(AuthService);

  hasRole(roles: UserRole | readonly UserRole[]): boolean {
    const acceptedRoles = Array.isArray(roles) ? roles : [roles];
    if (!environment.useBasicAuth) {
      return this.auth.hasRole([...acceptedRoles]);
    }

    const username = this.basicAuth.currentUsername()?.toLowerCase();
    const role = username ? DEV_BASIC_AUTH_ROLES[username] : undefined;
    return role != null && acceptedRoles.includes(role);
  }
}
