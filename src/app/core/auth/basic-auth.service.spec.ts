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
  });

  it('clears credentials', () => {
    service.setCredentials('buyer@ssds.dev', 'secret');
    service.clearCredentials();

    expect(service.authorizationHeader()).toBeNull();
  });

  it('rejects empty credentials', () => {
    expect(() => service.setCredentials('', '')).toThrowError('Basic Auth 帳號與密碼不可為空');
  });
});
