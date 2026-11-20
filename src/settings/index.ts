// 設定の枠の土台: 項目の決まり（types）と、項目の部品（SettingsField.svelte）・ホットキーの画面（HotkeySettings.svelte。決まりは `core/hotkeyBook`）。個別に読むなら `@3pino/app-kit-web/settings/<名前>`。
export type { SettingBinding, SettingControl, SettingOption } from './types';
export type { HotkeyItem } from './HotkeySettings.svelte';
