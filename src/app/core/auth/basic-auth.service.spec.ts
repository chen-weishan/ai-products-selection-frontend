import { TestBed } from '@angular/core/testing';
import { BasicAuthService } from './basic-auth.service';

describe('BasicAuthService', () => {
  let service: BasicAuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BasicAuthService);
  });

  it('creates a Basic authorization header without persisting the password', () => {
    service.setCredentials(' buyer@ssds.dev ', 'secret');

    expect(service.authorizationHeader()).toBe(`Basic ${btoa('buyer@ssds.dev:secret')}`);
    expect(service.currentUsername()).toBe('buyer@ssds.dev');
  });

  it('clears credentials', () => {
    service.setCredentials('buyer@ssds.dev', 'secret');
    service.clearCredentials();

    expect(service.currentUsername()).toBe('sysadmin@ssds.dev');
    expect(service.authorizationHeader()).toBe(`Basic ${btoa('sysadmin@ssds.dev:Ssds@2026')}`);
  });

  it('starts with the FR03 development account', () => {
    expect(service.currentUsername()).toBe('sysadmin@ssds.dev');
    expect(service.hasCredentials()).toBe(true);
  });

  it('rejects empty credentials', () => {
    expect(() => service.setCredentials('', '')).toThrowError('Basic Auth 帳號與密碼不可為空');
  });
});
