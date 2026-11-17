import { afterEach, describe, expect, it, vi } from 'vitest';
import { configurePlatform, injectedPlatform, isAndroid, osName } from './platform';

afterEach(() => {
  vi.unstubAllGlobals();
  configurePlatform({ globalName: '__APP_PLATFORM__' });
});

describe('injectedPlatform（注入の名前は configurePlatform で決める）', () => {
  it('既定の名前 __APP_PLATFORM__ を読む', () => {
    vi.stubGlobal('window', { __APP_PLATFORM__: { os: 'linux', desktop: true, android: false, capabilities: null } });
    expect(injectedPlatform()).toEqual({ os: 'linux', desktop: true, android: false, capabilities: null });
  });

  it('configurePlatform で変えた名前を読み、既定の名前は読まない', () => {
    configurePlatform({ globalName: '__MYAPP_PLATFORM__' });
    vi.stubGlobal('window', {
      __APP_PLATFORM__: { os: 'linux', desktop: true, android: false },
      __MYAPP_PLATFORM__: { os: 'android', desktop: false, android: true },
    });
    expect(injectedPlatform()?.os).toBe('android');
    expect(isAndroid()).toBe(true);
  });

  it('形が違う注入は null（推測に戻る）', () => {
    vi.stubGlobal('window', { __APP_PLATFORM__: { os: 1, desktop: true, android: false } });
    expect(injectedPlatform()).toBeNull();
    vi.stubGlobal('window', { __APP_PLATFORM__: 'linux' });
    expect(injectedPlatform()).toBeNull();
  });

  it('capabilities が文字列などオブジェクトでなければ null（オブジェクトなら中身は見ない）', () => {
    vi.stubGlobal('window', { __APP_PLATFORM__: { os: 'linux', desktop: true, android: false, capabilities: 'x' } });
    expect(injectedPlatform()?.capabilities).toBeNull();
  });

  it('注入が無いときは UA から推測する（Android の UA）', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 14)', platform: '' });
    expect(injectedPlatform()).toBeNull();
    expect(osName()).toBe('android');
    expect(isAndroid()).toBe(true);
  });
});
