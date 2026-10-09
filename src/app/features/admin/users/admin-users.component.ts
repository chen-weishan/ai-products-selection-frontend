import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, filter, finalize, forkJoin, switchMap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { DialogService } from '../../../services/dialog-service';
import {
  AdminUser,
  AdminUsersService,
  RoleCode,
  RoleOption,
  generatePassword,
} from '../admin-users.service';

type FormMode = 'CREATE' | 'EDIT' | 'PASSWORD';
type StatusFilter = 'ALL' | 'ACTIVE' | 'DISABLED' | 'LOCKED';

interface UserForm {
  email: string;
  displayName: string;
  password: string;
  roles: RoleCode[];
}

const MIN_PASSWORD = 8;

@Component({
  selector: 'app-admin-users',
  imports: [DatePipe, FormsModule, MatButtonModule, MatCheckboxModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  templateUrl: './admin-users.component.html',
  styleUrls: ['../admin-shared.scss', './admin-users.component.scss'],
})
export class AdminUsersComponent {
  private readonly api = inject(AdminUsersService);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly users = signal<AdminUser[]>([]);
  readonly roles = signal<RoleOption[]>([]);
  readonly keyword = signal('');
  readonly statusFilter = signal<StatusFilter>('ALL');
  readonly mode = signal<FormMode>('CREATE');
  readonly selectedId = signal<number | null>(null);
  /** 剛產生或剛設定的密碼，存檔成功後留在畫面上讓管理員轉交，切換使用者即清除。 */
  readonly revealedPassword = signal<string | null>(null);
  showPassword = false;
  /** 按過送出才顯示欄位錯誤，避免一打開表單就滿版紅字。 */
  attempted = false;

  form: UserForm = emptyForm();

  readonly selected = computed(() => this.users().find((user) => user.id === this.selectedId()) ?? null);
  readonly myEmail = computed(() => (this.auth.currentUser()?.email ?? '').toLowerCase());
  readonly filtered = computed(() => {
    const keyword = this.keyword().trim().toLowerCase();
    const status = this.statusFilter();
    return this.users().filter((user) => {
      const matchesKeyword = !keyword
        || user.email.toLowerCase().includes(keyword)
        || user.displayName.toLowerCase().includes(keyword);
      const matchesStatus = status === 'ALL'
        || (status === 'LOCKED' ? user.locked : user.status === status);
      return matchesKeyword && matchesStatus;
    });
  });
  readonly counts = computed(() => ({
    total: this.users().length,
    active: this.users().filter((user) => user.status === 'ACTIVE').length,
    disabled: this.users().filter((user) => user.status === 'DISABLED').length,
    locked: this.users().filter((user) => user.locked).length,
  }));

  constructor() {
    this.startCreate();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ users: this.api.list(), roles: this.api.roles() })
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ users, roles }) => {
          this.users.set(users);
          this.roles.set(roles);
        },
        error: (error: Error) => this.error.set(error.message),
      });
  }

  isSelf(user: AdminUser): boolean {
    return user.email.toLowerCase() === this.myEmail();
  }

  roleName(code: RoleCode): string {
    return this.roles().find((role) => role.code === code)?.name ?? code;
  }

  startCreate(): void {
    this.attempted = false;
    this.mode.set('CREATE');
    this.selectedId.set(null);
    this.revealedPassword.set(null);
    this.form = emptyForm();
    this.form.password = generatePassword();
    this.showPassword = true;
  }

  startEdit(user: AdminUser): void {
    this.attempted = false;
    this.mode.set('EDIT');
    this.selectedId.set(user.id);
    this.revealedPassword.set(null);
    this.form = { email: user.email, displayName: user.displayName, password: '', roles: [...user.roles] };
  }

  startPasswordReset(user: AdminUser): void {
    this.attempted = false;
    this.mode.set('PASSWORD');
    this.selectedId.set(user.id);
    this.revealedPassword.set(null);
    this.form = { ...emptyForm(), email: user.email, displayName: user.displayName, password: generatePassword() };
    this.showPassword = true;
  }

  regeneratePassword(): void {
    this.form.password = generatePassword();
    this.showPassword = true;
  }

  hasRole(code: RoleCode): boolean {
    return this.form.roles.includes(code);
  }

  toggleRole(code: RoleCode, checked: boolean): void {
    this.form.roles = checked
      ? [...new Set([...this.form.roles, code])]
      : this.form.roles.filter((role) => role !== code);
  }

  /** 編輯自己時不能拿掉 SYS_ADMIN，否則會把自己鎖在 S-14 外面。 */
  roleLocked(code: RoleCode): boolean {
    const user = this.selected();
    return this.mode() === 'EDIT' && code === 'SYS_ADMIN' && user != null && this.isSelf(user) && this.hasRole('SYS_ADMIN');
  }

  formErrors(): string[] {
    const errors: string[] = [];
    const mode = this.mode();
    if (mode === 'CREATE' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.form.email.trim())) errors.push('請輸入有效的 Email');
    if (mode !== 'PASSWORD' && !this.form.displayName.trim()) errors.push('請輸入顯示名稱');
    if (mode !== 'PASSWORD' && this.form.roles.length === 0) errors.push('至少勾選一個角色');
    if (mode !== 'EDIT' && (this.form.password.length < MIN_PASSWORD || this.form.password.length > 72)) {
      errors.push(`密碼長度須為 ${MIN_PASSWORD}～72 字元`);
    }
    return errors;
  }

  submit(): void {
    this.attempted = true;
    if (this.saving() || this.formErrors().length) return;
    const mode = this.mode();
    const id = this.selectedId();
    const password = this.form.password;
    let operation: Observable<AdminUser>;
    let message: string;
    if (mode === 'CREATE') {
      operation = this.api.create({
        email: this.form.email.trim(),
        displayName: this.form.displayName.trim(),
        password,
        roles: this.form.roles,
      });
      message = '已建立帳號';
    } else if (mode === 'EDIT' && id != null) {
      operation = this.api.update(id, { displayName: this.form.displayName.trim(), roles: this.form.roles });
      message = '已更新帳號';
    } else if (mode === 'PASSWORD' && id != null) {
      operation = this.api.resetPassword(id, password);
      message = '已重設密碼，帳號同時解除鎖定';
    } else {
      return;
    }
    this.run(operation, (user) => {
      this.success.set(`${message}：${user.displayName}（${user.email}）`);
      if (mode === 'EDIT') {
        this.startEdit(user);
      } else {
        // 新增或重設後保留密碼讓管理員轉交，表單切到該使用者
        this.mode.set('EDIT');
        this.selectedId.set(user.id);
        this.form = { email: user.email, displayName: user.displayName, password: '', roles: [...user.roles] };
        this.revealedPassword.set(password);
      }
    });
  }

  toggleStatus(user: AdminUser): void {
    if (this.saving()) return;
    const disabling = user.status === 'ACTIVE';
    this.dialogs.Confirm({
      title: disabling ? '停用帳號' : '重新啟用帳號',
      message: disabling
        ? `停用後「${user.displayName}」立即無法登入，已登入的畫面也會失效。確定停用？`
        : `確定重新啟用「${user.displayName}」？`,
      confirmText: disabling ? '確認停用' : '確認啟用',
      cancelText: '取消',
      isDanger: disabling,
    }).pipe(
      filter(Boolean),
      switchMap(() => {
        this.saving.set(true);
        this.error.set(null);
        return this.api.changeStatus(user.id, disabling ? 'DISABLED' : 'ACTIVE').pipe(finalize(() => this.saving.set(false)));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (updated) => {
        this.replace(updated);
        this.success.set(`${updated.displayName} 已${disabling ? '停用' : '重新啟用'}`);
      },
      error: (error: Error) => this.error.set(error.message),
    });
  }

  unlock(user: AdminUser): void {
    this.run(this.api.unlock(user.id), (updated) => this.success.set(`${updated.displayName} 已解除鎖定`));
  }

  copyPassword(): void {
    const password = this.revealedPassword() ?? this.form.password;
    navigator.clipboard?.writeText(password).then(
      () => this.success.set('密碼已複製到剪貼簿'),
      () => this.error.set('無法存取剪貼簿，請手動選取複製'),
    );
  }

  private run(operation: Observable<AdminUser>, onDone: (user: AdminUser) => void): void {
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    operation.pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (user) => {
        this.replace(user);
        onDone(user);
      },
      error: (error: Error) => this.error.set(error.message),
    });
  }

  private replace(user: AdminUser): void {
    this.users.update((users) => users.some((item) => item.id === user.id)
      ? users.map((item) => (item.id === user.id ? user : item))
      : [...users, user]);
  }
}

function emptyForm(): UserForm {
  return { email: '', displayName: '', password: '', roles: ['BUYER'] };
}
