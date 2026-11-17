// 試験用の Tauri の WebView の環境（パッケージ内の試験だけが使う。配布しない）。
// 注入値のグローバルの名前は既定の `__APP_PLATFORM__`（core/platform.ts）。
import { vi } from 'vitest';

export type TauriOs = 'windows' | 'linux' | 'android' | 'other';

const UA: Record<TauriOs, string> = {
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/120.0',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko)',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 9a) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
  other: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15',
};

/** 注入値（Rust が入れるのと同じ形）。capabilities は null（方針の無い形） */
export function injectedPlatform(os: TauriOs): Record<string, unknown> {
  return { os, desktop: os !== 'android', android: os === 'android', capabilities: null };
}

/** Tauri の WebView の環境を作る。後始末は afterEach で vi.unstubAllGlobals() */
export function stubTauri(opts: { os: TauriOs; inject?: Record<string, unknown>; globalName?: string }): void {
  vi.stubGlobal('navigator', { userAgent: UA[opts.os], platform: opts.os === 'windows' ? 'Win32' : 'Linux x86_64' });
  const window: Record<string, unknown> = {
    location: { search: '', protocol: 'tauri:', host: 'localhost' },
    __TAURI_INTERNALS__: { invoke: async () => null },
  };
  if (opts.inject !== undefined) window[opts.globalName ?? '__APP_PLATFORM__'] = opts.inject;
  vi.stubGlobal('window', window);
}
