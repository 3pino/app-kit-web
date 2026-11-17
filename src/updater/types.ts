// アップデートの状態（画面の表示と、裏の確認の判定が読む）。

export type UpdateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'latest' }
  | { kind: 'available'; version: string; notes: string | null }
  | { kind: 'permission' }
  | { kind: 'downloading'; downloaded: number; total: number | null }
  | { kind: 'installing' }
  | { kind: 'error'; message: string };

/** Tauri のアップデーター（デスクトップ）の取得の進み（plugin-updater の DownloadEvent と同じ形） */
export type DesktopDownloadEvent =
  | { event: 'Started'; data: { contentLength?: number | null } }
  | { event: 'Progress'; data: { chunkLength: number } }
  | { event: 'Finished' };

/** 見つかったデスクトップの更新（plugin-updater の Update の、使う部分だけ） */
export type DesktopUpdate = {
  version: string;
  body?: string | null;
  downloadAndInstall(onEvent: (ev: DesktopDownloadEvent) => void): Promise<void>;
  close(): Promise<void>;
};

/** GitHub のリリース（Android の APK を探すため。形は GitHub の API の応答と同じ） */
export type AndroidRelease = {
  tag_name: string;
  body?: string | null;
  assets: { name: string; browser_download_url: string }[];
};
