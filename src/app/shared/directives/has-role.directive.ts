import { Directive, Input, TemplateRef, ViewContainerRef, effect, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/models/auth-model';

@Directive({
  selector: '[appHasRole]',
  standalone: true
})
export class HasRoleDirective {
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private authService = inject(AuthService);

  private allowedRoles: UserRole[] = [];
  private hasView = false;

  @Input()
  set appHasRole(roles: UserRole | UserRole[]) {
    this.allowedRoles = Array.isArray(roles) ? roles : [roles];
    this.updateView();
  }

  constructor() {
    // 響應當前使用者狀態變更
    effect(() => {
      this.authService.currentUser();
      this.updateView();
    });
  }

  private updateView(): void {
    if (this.allowedRoles.length === 0) {
      if (!this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      }
      return;
    }

    const hasPermission = this.authService.hasRole(this.allowedRoles);

    if (hasPermission && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!hasPermission && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}

