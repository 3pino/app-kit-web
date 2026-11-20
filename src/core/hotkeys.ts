// ホットキーの文字（`Ctrl+Shift+Tab`）と、キーボードのイベントの対応。画面に依らない。
// 書き方: 修飾キーを Ctrl・Alt・Shift の順に並べ、最後にキー（`T`・`F2`・`Enter`・`ArrowLeft`・`Escape`）を `+` でつなぐ。
// Ctrl には、Mac の Cmd（Meta）も含める。英数字は、Shift・配列に依らず、キーの位置（code）で決める。

export type KeyEventLike = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'> & Partial<Pick<KeyboardEvent, 'code' | 'isComposing'>>;

/** 名前のあるキー（手で書いた文字の、大文字小文字をそろえる）。イベントのキーの名前と同じ綴り */
const NAMED = new Map(
  ['Mouse4', 'Mouse5', 'Enter', 'Tab', 'Escape', 'Space', 'Backspace', 'Delete', 'Insert', 'Home', 'End', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ...Array.from({ length: 24 }, (_, i) => `F${i + 1}`)].map((n) => [n.toLowerCase(), n] as const),
).set('esc', 'Escape');

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'OS']);

/** イベントから、ホットキーの文字を作る。修飾キーだけ・変換中のときは null */
export function hotkeyFromEvent(e: KeyEventLike): string | null {
  if (e.isComposing || MODIFIER_KEYS.has(e.key)) return null;
  const code = e.code ?? '';
  let base: string;
  if (/^Key[A-Z]$/.test(code)) base = code.slice(3);
  else if (/^Digit\d$/.test(code)) base = code.slice(5);
  else if (e.key === ' ') base = 'Space';
  else if (e.key === 'Esc') base = 'Escape';
  else base = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  const mods = [e.ctrlKey || e.metaKey ? 'Ctrl' : '', e.altKey ? 'Alt' : '', e.shiftKey ? 'Shift' : ''].filter(Boolean);
  return [...mods, base].join('+');
}

/** マウスのボタンのイベント（戻る・進むのボタン） */
export type MouseEventLike = Pick<MouseEvent, 'button' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>;

/** マウスの「戻る」（4 番目）「進む」（5 番目）のボタンから、ホットキーの文字（`Mouse4`・`Mouse5`）を作る。ほかのボタンは null */
export function hotkeyFromMouse(e: MouseEventLike): string | null {
  const base = e.button === 3 ? 'Mouse4' : e.button === 4 ? 'Mouse5' : null;
  if (base === null) return null;
  const mods = [e.ctrlKey || e.metaKey ? 'Ctrl' : '', e.altKey ? 'Alt' : '', e.shiftKey ? 'Shift' : ''].filter(Boolean);
  return [...mods, base].join('+');
}

/** マウスのボタンが、ホットキーのどれかに当たるか */
export function matchesMouse(e: MouseEventLike, keys: readonly string[]): boolean {
  const pressed = hotkeyFromMouse(e);
  return pressed !== null && keys.some((k) => normalizeHotkey(k) === pressed);
}

/** 書かれたホットキーの文字を、イベントから作る文字と同じ形にそろえる（大文字小文字・並び順・Cmd・Control）。読めなければ null */
export function normalizeHotkey(text: string): string | null {
  const parts = text.split('+').map((p) => p.trim());
  // 最後が空なら、キーが `+` そのもの（例: `Ctrl++`）
  let key = parts.pop() ?? '';
  if (key === '' && parts.length > 0 && parts[parts.length - 1] === '') {
    parts.pop();
    key = '+';
  }
  if (key === '') return null;
  const mod = new Set<string>();
  for (const p of parts) {
    const m = p.toLowerCase();
    if (m === 'ctrl' || m === 'control' || m === 'cmd' || m === 'meta' || m === 'mod') mod.add('Ctrl');
    else if (m === 'alt' || m === 'option') mod.add('Alt');
    else if (m === 'shift') mod.add('Shift');
    else return null;
  }
  if (MODIFIER_KEYS.has(key) || ['ctrl', 'cmd', 'mod', 'option'].includes(key.toLowerCase())) return null;
  const base = key.length === 1 ? key.toUpperCase() : (NAMED.get(key.toLowerCase()) ?? key);
  return [...['Ctrl', 'Alt', 'Shift'].filter((m) => mod.has(m)), base].join('+');
}

/** イベントが、ホットキーのどれかに当たるか */
export function matchesHotkey(e: KeyEventLike, keys: readonly string[]): boolean {
  const pressed = hotkeyFromEvent(e);
  return pressed !== null && keys.some((k) => normalizeHotkey(k) === pressed);
}

const SHOWN: Record<string, string> = { Mouse4: 'マウス戻る', Mouse5: 'マウス進む', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Escape: 'Esc', ' ': 'Space' };

/** 画面に出す形（`Alt+ArrowLeft` → `Alt+←`） */
export function formatHotkey(text: string): string {
  return text
    .split('+')
    .map((p) => SHOWN[p] ?? p)
    .join('+');
}

/** 修飾キー（Ctrl・Alt）を含まないか。文字を打っている途中（入力欄）では、このようなホットキーは働かせない */
export function isPlainHotkey(text: string): boolean {
  const n = normalizeHotkey(text);
  return n !== null && !n.startsWith('Ctrl') && !n.startsWith('Alt');
}

/** Shift を押していても、押していないものとして当てる（矢印: Shift を押しながらは、選びに足す） */
export function matchesIgnoringShift(e: KeyEventLike, keys: readonly string[]): boolean {
  return matchesHotkey({ ...e, key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, shiftKey: false }, keys);
}
