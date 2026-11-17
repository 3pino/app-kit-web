import { isNewer } from '../core/semver';
import type { AndroidRelease, DesktopUpdate, UpdateState } from './types';

// アプリ自身のアップデート（デスクトップは Tauri のアップデーター、Android は APK を直接入れる）。
// 仕組みに触る部分（Tauri の呼び出し・GitHub への問い合わせ・APK のインストール）は UpdateBackend の口の向こう。アプリが渡す。

export type UpdateBackend = {
  /** 更新の仕組み。'none' なら何もしない（ブラウザーの開発など） */
  kind(): 'desktop' | 'android' | 'none';
  /** いまの版（取れなければ例外。表示できないだけなので呼び出し側は無視してよい） */
  version(): Promise<string>;
  /** デスクトップ: 新しい版があれば、その更新。無ければ null */
  checkDesktop(): Promise<DesktopUpdate | null>;
  /** デスクトップ: 更新のあと、アプリを起動し直す */
  relaunch(): Promise<void>;
  /** Android: 最新のリリース（失敗は例外。メッセージは画面に出る） */
  fetchLatestAndroid(): Promise<AndroidRelease>;
  /** Android: APK を入れてよいか（許可）。許可がなければ、許可の画面を開く */
  canInstallAndroid(): Promise<boolean>;
  openInstallSettings(): Promise<void>;
  /** Android: APK を取得して入れる（進みを onProgress へ） */
  downloadAndInstallAndroid(url: string, onProgress: (p: { downloaded: number; total: number | null }) => void): Promise<void>;
  /** リリースのページを開く（手で入れる場合） */
  openReleasePage(): Promise<void>;
};

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export class Updater {
  version = $state<string | null>(null);
  state = $state<UpdateState>({ kind: 'idle' });
  /** 更新の仕組みがあるか（デスクトップ版・Android 版だけ true） */
  readonly supported: boolean;
  private apply: (() => Promise<void>) | null = null;
  private busy = false;

  constructor(
    private readonly backend: UpdateBackend,
    supported: boolean,
  ) {
    this.supported = supported;
  }

  async loadVersion(): Promise<void> {
    if (!this.supported || this.version) return;
    try {
      this.version = await this.backend.version();
    } catch {
      // 表示できないだけ
    }
  }

  /** quiet なら（定期の確認）、失敗しても画面にエラーを出さず、待機中に戻す */
  async check(opts: { quiet?: boolean } = {}): Promise<void> {
    if (!this.supported || this.busy) return;
    this.busy = true;
    try {
      await this.refresh(false);
    } catch (e) {
      this.state = opts.quiet ? { kind: 'idle' } : { kind: 'error', message: errorMessage(e) };
    } finally {
      this.busy = false;
    }
  }

  async install(): Promise<void> {
    if (!this.supported || this.busy || (this.state.kind !== 'available' && this.state.kind !== 'permission')) return;
    this.busy = true;
    try {
      // 通知後に次の版が出ていることがある。古い URL や Update を使わず、
      // 許可画面から戻った場合も含め、押すたびに最新を確認してから取得する。
      await this.refresh(true);
      await this.apply?.();
    } catch (e) {
      this.state = { kind: 'error', message: errorMessage(e) };
    } finally {
      this.apply = null;
      this.busy = false;
    }
  }

  private async refresh(prepareInstall: boolean): Promise<void> {
    this.state = { kind: 'checking' };
    this.apply = null;
    await this.loadVersion();
    if (this.backend.kind() === 'android') await this.checkAndroid(prepareInstall);
    else await this.checkDesktop(prepareInstall);
  }

  async openReleasePage(): Promise<void> {
    await this.backend.openReleasePage();
  }

  private async checkDesktop(prepareInstall: boolean): Promise<void> {
    const update = await this.backend.checkDesktop();
    if (!update) {
      this.state = { kind: 'latest' };
      return;
    }
    this.state = { kind: 'available', version: update.version, notes: update.body ?? null };
    if (!prepareInstall) {
      await update.close();
      return;
    }
    this.apply = async () => {
      try {
        await this.installDesktop(update);
      } finally {
        // インストーラー側で既に解放されている場合は無視する。
        await update.close().catch(() => {});
      }
    };
  }

  private async installDesktop(update: DesktopUpdate): Promise<void> {
    let downloaded = 0;
    let total: number | null = null;
    this.state = { kind: 'downloading', downloaded, total };
    await update.downloadAndInstall((ev) => {
      if (ev.event === 'Started') total = ev.data.contentLength ?? null;
      else if (ev.event === 'Progress') downloaded += ev.data.chunkLength;
      else if (ev.event === 'Finished') {
        this.state = { kind: 'installing' };
        return;
      }
      this.state = { kind: 'downloading', downloaded, total };
    });
    this.state = { kind: 'installing' };
    await this.backend.relaunch();
  }

  private async checkAndroid(prepareInstall: boolean): Promise<void> {
    const rel = await this.backend.fetchLatestAndroid();
    const latest = rel.tag_name.replace(/^v/, '');
    if (!this.version || !isNewer(latest, this.version)) {
      this.state = { kind: 'latest' };
      return;
    }
    const apks = rel.assets.filter((a) => a.name.toLowerCase().endsWith('.apk'));
    const apk =
      apks.find((a) => /universal/i.test(a.name)) ?? apks.find((a) => /arm64|aarch64/i.test(a.name)) ?? apks[0];
    if (!apk) throw new Error(`v${latest} に APK がありません`);

    this.state = { kind: 'available', version: latest, notes: rel.body };
    if (!prepareInstall) return;
    const notes = rel.body;
    this.apply = async () => {
      if (!(await this.backend.canInstallAndroid())) {
        this.state = { kind: 'permission' };
        await this.backend.openInstallSettings();
        return;
      }
      this.state = { kind: 'downloading', downloaded: 0, total: null };
      await this.backend.downloadAndInstallAndroid(apk.browser_download_url, (p) => {
        if (this.state.kind === 'downloading') this.state = { kind: 'downloading', ...p };
      });
      this.state = { kind: 'installing' };
      // インストールを中断されたときにもう一度押せるようにする
      setTimeout(() => {
        if (this.state.kind === 'installing') this.state = { kind: 'available', version: latest, notes };
      }, 4000);
    };
  }
}
