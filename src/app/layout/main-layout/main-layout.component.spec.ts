import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { UserInfo, UserRole } from '../../core/models/auth-model';

import { MainLayoutComponent } from './main-layout.component';

describe('MainLayoutComponent', () => {
  let component: MainLayoutComponent;
  let fixture: ComponentFixture<MainLayoutComponent>;
  const currentUser = signal<UserInfo | null>(null);

  beforeEach(async () => {
    currentUser.set(null);
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      // 樣板有 routerLink，沒有 Router 的 provider 會在建立時就 NG0201
      providers: [provideRouter([]), { provide: AuthService, useValue: { currentUser } }],
    }).compileComponents();

    fixture = TestBed.createComponent(MainLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  const menus: [UserRole, string[]][] = [
    ['BUYER', ['/dashboard', '/products', '/ranking', '/trends', '/heat-tags', '/sourcing', '/risks', '/decisions', '/reports']],
    ['BUYER_LEAD', ['/dashboard', '/weights', '/ranking', '/reports']],
    ['DATA_ADMIN', ['/dashboard', '/trends', '/festivals', '/imports']],
    ['SYS_ADMIN', ['/dashboard', '/products', '/ranking', '/trends', '/heat-tags', '/sourcing', '/ai-tasks', '/weights', '/weights/calibration', '/festivals', '/imports', '/risks', '/decisions', '/reports', '/admin']],
    ['VIEWER', ['/dashboard', '/products', '/ranking', '/trends', '/risks', '/decisions', '/reports']],
  ];

  for (const [role, paths] of menus) {
    it(`renders the requested menu and order for ${role}`, () => {
      currentUser.set({ role, roles: [role] });
      fixture.detectChanges();
      const links = [...fixture.nativeElement.querySelectorAll('.nav-link-item')] as HTMLAnchorElement[];
      expect(links.map(link => link.getAttribute('href'))).toEqual(paths);
    });
  }

  it('combines assigned roles without duplicate links and reacts to role changes', () => {
    currentUser.set({ role: 'BUYER_LEAD', roles: ['BUYER_LEAD', 'DATA_ADMIN'] });
    expect(component.navItems().map(item => item.path)).toEqual([
      '/dashboard', '/weights', '/ranking', '/reports', '/trends', '/festivals', '/imports',
    ]);
    currentUser.set({ role: 'VIEWER', roles: ['VIEWER', 'SYS_ADMIN'] });
    expect(component.navItems()).toHaveLength(15);
    currentUser.set(null);
    expect(component.navItems()).toEqual([]);
  });

  it('supports identities containing only the primary role', () => {
    currentUser.set({ role: 'DATA_ADMIN' });
    expect(component.navItems().map(item => item.path)).toEqual(menus[2][1]);
  });
});
