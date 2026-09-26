import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HasRoleDirective } from './has-role.directive';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  imports: [HasRoleDirective],
  template: `<div *appHasRole="'BUYER'">content</div>`,
})
class TestHostComponent {}

describe('HasRoleDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  const currentUser = signal(null);
  const hasRole = vi.fn();

  beforeEach(async () => {
    hasRole.mockReset();
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        {
          provide: AuthService,
          useValue: { currentUser, hasRole },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('should create an instance', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
