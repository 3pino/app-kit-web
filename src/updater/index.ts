// アップデートの土台: 状態（types）・判定（updateCheck）・状態の機械（Updater）。仕組みへの口は UpdateBackend（アプリが作る）。
export * from './types';
export * from './updateCheck';
export { Updater, type UpdateBackend } from './updater.svelte';
