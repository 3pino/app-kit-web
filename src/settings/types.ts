// 設定の 1 項目の決まり（部品の種類と、読み書きの口）。値は持たない。読み書きはアプリが決めて渡す。

/** 選択肢（segmented・select） */
export type SettingOption = { value: string; label: string; icon: string | null };

/** 部品の種類 */
export type SettingControl =
  | { type: 'toggle' }
  | { type: 'segmented'; options: SettingOption[] }
  | { type: 'select'; options: SettingOption[] }
  | { type: 'slider'; min: number; max: number; step: number; scale: number; unit: string };

/** 項目の読み書き。`preview` があれば、動かしている間（Slider）はそれを呼び、離したときに `set` を呼ぶ */
export type SettingBinding = {
  get(): unknown;
  set(value: unknown): void;
  preview?(value: unknown): void;
};
