import { Injectable, inject } from '@angular/core';
import { UserRole } from '../models/auth-model';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AccessControlService {
  private readonly auth = inject(AuthService);

  hasRole(roles: UserRole | readonly UserRole[]): boolean {
    const acceptedRoles = Array.isArray(roles) ? roles : [roles];
    return this.auth.hasRole([...acceptedRoles]);
  }
}
