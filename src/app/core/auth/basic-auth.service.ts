import { Injectable, computed, signal } from '@angular/core';

export interface BasicCredentials {
  username: string;
  password: string;
}

@Injectable({
  providedIn: 'root',
})
export class BasicAuthService {
  private readonly credentials = signal<BasicCredentials | null>(null);

  readonly hasCredentials = computed(() => this.credentials() !== null);

  readonly authorizationHeader = computed(() => {
    const credentials = this.credentials();
    if (!credentials) {
      return null;
    }

    return `Basic ${encodeUtf8Base64(`${credentials.username}:${credentials.password}`)}`;
  });

  setCredentials(username: string, password: string): void {
    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password) {
      throw new Error('Basic Auth 帳號與密碼不可為空');
    }

    this.credentials.set({
      username: normalizedUsername,
      password,
    });
  }

  clearCredentials(): void {
    this.credentials.set(null);
  }
}

function encodeUtf8Base64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}
