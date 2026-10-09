import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { DialogService } from '../../../services/dialog-service';
import { AdminUser, AdminUsersService } from '../admin-users.service';
import { AdminUsersComponent } from './admin-users.component';

describe('AdminUsersComponent', () => {
  let fixture: ComponentFixture<AdminUsersComponent>;
  let component: AdminUsersComponent;
  const user = (id: number, email: string, extra: Partial<AdminUser> = {}): AdminUser => ({
    id, email, displayName: email.split('@')[0], status: 'ACTIVE', roles: ['BUYER'],
    locked: false, lockedUntil: null, failedAttempts: 0, createdAt: null, updatedAt: null, ...extra,
  });
  const api = {
    list: vi.fn(),
    roles: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    changeStatus: vi.fn(),
    resetPassword: vi.fn(),
    unlock: vi.fn(),
  };
  const dialogs = { Confirm: vi.fn(() => of(true)) };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.list.mockReturnValue(of([
      user(1, 'buyer@ssds.dev'),
      user(4, 'sysadmin@ssds.dev', { roles: ['SYS_ADMIN'] }),
      user(7, 'locked@ssds.dev', { locked: true, lockedUntil: '2026-10-09T10:00:00Z' }),
    ]));
    api.roles.mockReturnValue(of([
      { code: 'BUYER', name: '採購專員', description: null },
      { code: 'SYS_ADMIN', name: '系統管理員', description: null },
    ]));
    await TestBed.configureTestingModule({
      imports: [AdminUsersComponent],
      providers: [
        { provide: AdminUsersService, useValue: api },
        { provide: AuthService, useValue: { currentUser: signal({ email: 'SysAdmin@ssds.dev' }) } },
        { provide: DialogService, useValue: dialogs },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminUsersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lists users with Chinese role names and filters by status', () => {
    expect(fixture.nativeElement.textContent).toContain('採購專員');
    component.statusFilter.set('LOCKED');
    expect(component.filtered().map((item) => item.id)).toEqual([7]);
    component.statusFilter.set('ALL');
    component.keyword.set('BUYER');
    expect(component.filtered().map((item) => item.id)).toEqual([1]);
  });

  it('prefills a random password and shows it after creating the account', () => {
    expect(component.mode()).toBe('CREATE');
    expect(component.form.password).toHaveLength(12);
    const password = component.form.password;
    api.create.mockReturnValue(of(user(9, 'new@ssds.dev')));

    component.form.email = 'new@ssds.dev';
    component.form.displayName = '新人';
    component.submit();

    expect(api.create).toHaveBeenCalledWith({ email: 'new@ssds.dev', displayName: '新人', password, roles: ['BUYER'] });
    expect(component.revealedPassword()).toBe(password);
    expect(component.users().some((item) => item.id === 9)).toBe(true);
  });

  it('shows validation errors only after a submit attempt', () => {
    component.form.email = '';
    expect(component.attempted).toBe(false);
    component.submit();
    expect(component.attempted).toBe(true);
    expect(component.formErrors()).toContain('請輸入有效的 Email');
    expect(api.create).not.toHaveBeenCalled();
  });

  it('marks the current admin and locks their own SYS_ADMIN role', () => {
    const me = component.users().find((item) => item.id === 4)!;
    expect(component.isSelf(me)).toBe(true);
    component.startEdit(me);
    expect(component.roleLocked('SYS_ADMIN')).toBe(true);
  });

  it('disables a user after confirmation', () => {
    api.changeStatus.mockReturnValue(of(user(1, 'buyer@ssds.dev', { status: 'DISABLED' })));

    component.toggleStatus(component.users()[0]);

    expect(dialogs.Confirm).toHaveBeenCalled();
    expect(api.changeStatus).toHaveBeenCalledWith(1, 'DISABLED');
    expect(component.users()[0].status).toBe('DISABLED');
  });
});
