import { describe, expect, it } from 'vitest';
import { Updater, type UpdateBackend } from './updater.svelte';
import type { DesktopUpdate } from './types';

// 仕組みの口を偽物にして、状態の機械（確認・取得・許可・インストール）を見る
function fakeDesktop(version: string, log: string[]): DesktopUpdate {
  return {
    version,
    body: 'notes',
    async downloadAndInstall(on) {
      log.push('download');
      on({ event: 'Started', data: { contentLength: 10 } });
      on({ event: 'Progress', data: { chunkLength: 10 } });
      on({ event: 'Finished' });
    },
    async close() {
      log.push('close');
    },
  };
}

function backend(over: Partial<UpdateBackend> & { log?: string[] } = {}): UpdateBackend {
  const log = over.log ?? [];
  return {
    kind: () => 'desktop',
    version: async () => '1.0.0',
    checkDesktop: async () => fakeDesktop('1.1.0', log),
    relaunch: async () => {
      log.push('relaunch');
    },
    fetchLatestAndroid: async () => ({ tag_name: 'v1.1.0', body: 'n', assets: [{ name: 'app-arm64.apk', browser_download_url: 'u' }] }),
    canInstallAndroid: async () => true,
    openInstallSettings: async () => {
      log.push('settings');
    },
    downloadAndInstallAndroid: async (url, p) => {
      log.push(`apk:${url}`);
      p({ downloaded: 1, total: 2 });
    },
    openReleasePage: async () => {},
    ...over,
  };
}

describe('Updater（状態の機械）', () => {
  it('対応していなければ、何もしない', async () => {
    const u = new Updater(backend(), false);
    await u.check();
    expect(u.state.kind).toBe('idle');
  });

  it('デスクトップ: 新しい版が無ければ latest、あれば available（確認だけなら取得しない）', async () => {
    const log: string[] = [];
    const none = new Updater(backend({ checkDesktop: async () => null }), true);
    await none.check();
    expect(none.state.kind).toBe('latest');

    const u = new Updater(backend({ log }), true);
    await u.check();
    expect(u.state).toEqual({ kind: 'available', version: '1.1.0', notes: 'notes' });
    expect(log).toEqual(['close']);
  });

  it('デスクトップ: install は最新を確認してから取得し、起動し直す', async () => {
    const log: string[] = [];
    const u = new Updater(backend({ log }), true);
    await u.check();
    await u.install();
    expect(log).toEqual(['close', 'download', 'relaunch', 'close']);
    expect(u.state.kind).toBe('installing');
  });

  it('Android: 許可が無ければ permission にして、許可の画面を開く', async () => {
    const log: string[] = [];
    const u = new Updater(backend({ kind: () => 'android', canInstallAndroid: async () => false, log }), true);
    await u.check();
    expect(u.state.kind).toBe('available');
    await u.install();
    expect(u.state.kind).toBe('permission');
    expect(log).toEqual(['settings']);
  });

  it('Android: 許可があれば APK を取り、進みを出す', async () => {
    const log: string[] = [];
    const u = new Updater(backend({ kind: () => 'android', log }), true);
    await u.check();
    await u.install();
    expect(log).toEqual(['apk:u']);
    expect(u.state.kind).toBe('installing');
  });

  it('確認が失敗したら、quiet なら idle、そうでなければ error（メッセージ付き）', async () => {
    const fail = backend({ checkDesktop: async () => { throw new Error('boom'); } });
    const quiet = new Updater(fail, true);
    await quiet.check({ quiet: true });
    expect(quiet.state.kind).toBe('idle');
    const loud = new Updater(fail, true);
    await loud.check();
    expect(loud.state).toEqual({ kind: 'error', message: 'boom' });
  });

  it('Android: APK が無ければ、そう伝える（取得はしない）', async () => {
    const u = new Updater(
      backend({ kind: () => 'android', fetchLatestAndroid: async () => ({ tag_name: 'v2.0.0', body: null, assets: [] }) }),
      true,
    );
    await u.check();
    expect(u.state).toEqual({ kind: 'error', message: 'v2.0.0 に APK がありません' }); // quiet でないので error
  });
});
