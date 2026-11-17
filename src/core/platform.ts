// デバイスの判定（土台）。
// Tauri では、Rust がアプリごとに決めた名前の WebView のグローバル（既定は `__APP_PLATFORM__`。アプリは configurePlatform で名前を決める）に
// デバイスの事実（OS・Android か・デスクトップか）を入れる。値が正しい形で有れば、それを使う（UA 文字列を見ない）。
// 無い・壊れている項目は、UA などから推測する（安全側）。
// アプリごとの方針（何ができるか）は、アプリ側が持つ（このファイルは OS の判定だけ）。

/** Rust が入れるデバイスの事実（JSON は camelCase） */
export type InjectedPlatform = {
  /** "windows" | "linux" | "android" | "ios" | "other"（Windows・Linux・Android 以外は other） */
  os: string;
  /** デスクトップの Tauri か（Android 以外） */
  desktop: boolean;
  /** Android の Tauri か */
  android: boolean;
  /** アプリごとの方針。形が違えば null（アプリ側が推測に戻す） */
  capabilities: Record<string, unknown> | null;
};

/**
 * 名前の置き場所は globalThis の Symbol.for の枠。同じモジュールが 2 つ読まれても（試験の環境など）、
 * どちらのコピーも同じ名前を見る（片方だけ configure されて、もう片方が既定の名前を読むことを防ぐ）
 */
const CONFIG_KEY = Symbol.for('@3pino/app-kit-web:platform');

type PlatformConfig = { globalName: string };

function config(): PlatformConfig {
  const g = globalThis as unknown as Record<symbol, PlatformConfig | undefined>;
  return (g[CONFIG_KEY] ??= { globalName: '__APP_PLATFORM__' });
}

/**
 * Rust が入れるグローバルの名前を決める。アプリの起動の最初（判定を呼ぶ前）に 1 回呼ぶ。既定は `__APP_PLATFORM__`。
 * 例: disnans は '__DISNANS_PLATFORM__'（app/src/lib/platformGlobal.ts で呼ぶ）
 */
export function configurePlatform(opts: { globalName: string }): void {
  config().globalName = opts.globalName;
}

/** Rust が入れたデバイスの事実。無い・形が違うときは null（呼び出し側は推測する） */
export function injectedPlatform(): InjectedPlatform | null {
  if (typeof window === 'undefined') return null;
  const raw = (window as unknown as Record<string, unknown>)[config().globalName];
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.os !== 'string' || typeof v.desktop !== 'boolean' || typeof v.android !== 'boolean') return null;
  const caps = v.capabilities && typeof v.capabilities === 'object' ? (v.capabilities as Record<string, unknown>) : null;
  return { os: v.os, desktop: v.desktop, android: v.android, capabilities: caps };
}

/** 診断ログに載せる UA の文字列（判定には使わないこと。判定はこのファイルの関数で行う） */
export function userAgentForLog(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent;
}

/** このデバイスの OS の名前（windows・linux・android・ios・other。分からなければ空）。Rust の値が正しければそれ、無ければ UA から */
export function osName(): string {
  const os = injectedPlatform()?.os;
  if (os && os !== 'other') return os;
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/windows/i.test(ua)) return 'windows';
  if (/linux/i.test(ua)) return 'linux';
  return '';
}

/** Tauri の中か（WebView の内部オブジェクトの有無） */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Android か。Rust の値があればそれ、無ければ UA */
export function isAndroid(): boolean {
  const info = injectedPlatform();
  if (info) return info.android;
  return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
}

/** Linux の Tauri 版（WebKitGTK）。ファイルのドロップとクリップボードの画像の扱いが他と違う */
export function isLinuxDesktop(): boolean {
  if (!isTauri() || isAndroid()) return false;
  const info = injectedPlatform();
  if (info) return info.os === 'linux';
  return typeof navigator !== 'undefined' && /linux/i.test(navigator.userAgent);
}

/** UA と platform の文字列から、Windows か Linux で Android でないか（デスクトップのストレージの判定に使う） */
export function supportsDesktopStoragePlatform(userAgent: string, platform = ''): boolean {
  const agent = `${userAgent} ${platform}`;
  return /windows|linux/i.test(agent) && !/android/i.test(agent);
}

/** Windows か Linux の Tauri 版か。Rust の値を優先し、無ければ UA */
export function isDesktopWindowsOrLinuxTauri(): boolean {
  if (!isTauri() || isAndroid()) return false;
  const info = injectedPlatform();
  if (info) return info.os === 'windows' || info.os === 'linux';
  return typeof navigator !== 'undefined' && supportsDesktopStoragePlatform(navigator.userAgent, navigator.platform);
}
