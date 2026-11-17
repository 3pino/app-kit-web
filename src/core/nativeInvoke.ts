/**
 * Tauri のプラグイン（Android の notifier・screen など）の呼び出しを 1 か所にまとめる。アプリ側でプラグイン名の型を決めてよい。
 * コマンド名は `plugin:<名前>|<コマンド>` の形。`@tauri-apps/api/core` は必要になったときに読む（Tauri 以外では呼ばれない）。
 */
export async function invokeNative<T = void>(plugin: string, cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  const name = `plugin:${plugin}|${cmd}`;
  // 引数の無い呼び出しは、引数を渡さない形のまま（呼び出しの形を変えない）
  return args === undefined ? invoke<T>(name) : invoke<T>(name, args);
}
