// ホットキーの文字（`Ctrl+Shift+Tab`）と、キーボードのイベントの対応。画面に依らない。
// 書き方: 修飾キーを Ctrl・Alt・Shift の順に並べ、最後にキー（`T`・`F2`・`Enter`・`ArrowLeft`・`Escape`）を `+` でつなぐ。
// 既定（オプションなし）: Ctrl には Mac の Cmd（Meta）も含める。英数字は、Shift・配列に依らず、キーの位置（code）で決める。
// 使う側は、`HotkeyOptions` で決まりを変えられる（Meta を別の修飾キーにする・Ctrl を `Mod` と書く・押した文字で当てる・`+` を `Plus` と書く）。
// 既定のときの結果は、オプションを足す前と同じ。

export type KeyEventLike = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'> & Partial<Pick<KeyboardEvent, 'code' | 'isComposing'>>;

/** ホットキーの決まり（省くと既定） */
export type HotkeyOptions = {
  /** Meta（Windows キー・Cmd）。'fold'（既定）は Ctrl と同じに扱う。'separate' は Ctrl と別の修飾キー（`Meta`） */
  meta?: 'fold' | 'separate';
  /** Ctrl の書き方（記録と正規化の出力）。'Ctrl'（既定）か 'Mod'（プラグインの manifest と同じ書き方） */
  ctrl?: 'Ctrl' | 'Mod';
  /** 英字・数字を当てる元。'code'（既定。キーの位置だけ）か 'key-then-code'（押した文字が一致すれば当てる。だめならキーの位置） */
  letters?: 'code' | 'key-then-code';
  /** `+` キーの書き方。'literal'（既定。`Ctrl++`）か 'Plus'（`Ctrl+Plus`） */
  plus?: 'literal' | 'Plus';
};

type Resolved = Required<HotkeyOptions>;
const DEFAULTS: Resolved = { meta: 'fold', ctrl: 'Ctrl', letters: 'code', plus: 'literal' };
const resolve = (o?: HotkeyOptions): Resolved => ({ ...DEFAULTS, ...o });

/** 名前のあるキー（手で書いた文字の、大文字小文字をそろえる）。イベントのキーの名前と同じ綴り */
const NAMED = new Map(
  ['Mouse4', 'Mouse5', 'Enter', 'Tab', 'Escape', 'Space', 'Backspace', 'Delete', 'Insert', 'Home', 'End', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ...Array.from({ length: 24 }, (_, i) => `F${i + 1}`)].map((n) => [n.toLowerCase(), n] as const),
).set('esc', 'Escape');

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'OS']);

/** 修飾キーの並び（Ctrl・Meta・Alt・Shift。Meta は separate のときだけ） */
function modifiers(ctrl: boolean, meta: boolean, alt: boolean, shift: boolean, o: Resolved): string[] {
  const out: string[] = [];
  if (o.meta === 'separate') {
    if (ctrl) out.push(o.ctrl);
    if (meta) out.push('Meta');
  } else if (ctrl || meta) out.push(o.ctrl);
  if (alt) out.push('Alt');
  if (shift) out.push('Shift');
  return out;
}

/** イベントから、ホットキーの文字を作る。修飾キーだけ・変換中のときは null */
export function hotkeyFromEvent(e: KeyEventLike, opts?: HotkeyOptions): string | null {
  return keyFromEvent(e, resolve(opts), false);
}

/** `byKey`: 押した文字（e.key）で作る。英字・数字の照合の片方に使う */
function keyFromEvent(e: KeyEventLike, o: Resolved, byKey: boolean): string | null {
  if (e.isComposing || MODIFIER_KEYS.has(e.key)) return null;
  const code = e.code ?? '';
  let base: string;
  if (!byKey && /^Key[A-Z]$/.test(code)) base = code.slice(3);
  else if (!byKey && /^Digit\d$/.test(code)) base = code.slice(5);
  else if (e.key === ' ') base = 'Space';
  else if (e.key === 'Esc') base = 'Escape';
  else if (e.key === '+') base = o.plus === 'Plus' ? 'Plus' : '+';
  else base = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  return [...modifiers(e.ctrlKey, e.metaKey, e.altKey, e.shiftKey, o), base].join('+');
}

/** マウスのボタンのイベント（戻る・進むのボタン） */
export type MouseEventLike = Pick<MouseEvent, 'button' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>;

/** マウスの「戻る」（4 番目）「進む」（5 番目）のボタンから、ホットキーの文字（`Mouse4`・`Mouse5`）を作る。ほかのボタンは null */
export function hotkeyFromMouse(e: MouseEventLike, opts?: HotkeyOptions): string | null {
  const base = e.button === 3 ? 'Mouse4' : e.button === 4 ? 'Mouse5' : null;
  if (base === null) return null;
  return [...modifiers(e.ctrlKey, e.metaKey, e.altKey, e.shiftKey, resolve(opts)), base].join('+');
}

/** マウスのボタンが、ホットキーのどれかに当たるか */
export function matchesMouse(e: MouseEventLike, keys: readonly string[], opts?: HotkeyOptions): boolean {
  const pressed = hotkeyFromMouse(e, opts);
  return pressed !== null && keys.some((k) => normalizeHotkey(k, opts) === pressed);
}

/**
 * 書かれたホットキーの文字を、イベントから作る文字と同じ形にそろえる（大文字小文字・並び順・Cmd・Control）。読めなければ null。
 * 空白で区切ると、連続して押すキー（`G G`・`Ctrl+K Ctrl+C`。1 つめを押したあと、1 秒以内に次を押す）
 */
export function normalizeHotkey(text: string, opts?: HotkeyOptions): string | null {
  const o = resolve(opts);
  // `Ctrl + T` のように、`+` のまわりの空白は無いものとして、そのあとで空白を区切りにする
  const chords = text.trim().replace(/\s*\+\s*/g, '+').split(/\s+/);
  const out: string[] = [];
  for (const c of chords) {
    const n = normalizeChord(c, o);
    if (n === null) return null;
    out.push(n);
  }
  return out.join(' ');
}

/** 1 回のキー（修飾キー + キー）をそろえる */
function normalizeChord(text: string, o: Resolved): string | null {
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
    if (m === 'ctrl' || m === 'control' || m === 'mod') mod.add('Ctrl');
    else if (m === 'cmd' || m === 'meta') mod.add(o.meta === 'separate' ? 'Meta' : 'Ctrl');
    else if (m === 'alt' || m === 'option') mod.add('Alt');
    else if (m === 'shift') mod.add('Shift');
    else return null;
  }
  if (MODIFIER_KEYS.has(key) || ['ctrl', 'cmd', 'mod', 'option'].includes(key.toLowerCase())) return null;
  let base = key.length === 1 ? key.toUpperCase() : (NAMED.get(key.toLowerCase()) ?? key);
  if (o.plus === 'Plus') {
    if (base === '+') base = 'Plus';
    else if (base.toLowerCase() === 'plus') base = 'Plus';
  }
  const ctrlName = o.ctrl;
  const order = o.meta === 'separate' ? ['Ctrl', 'Meta', 'Alt', 'Shift'] : ['Ctrl', 'Alt', 'Shift'];
  return [...order.filter((m) => mod.has(m)).map((m) => (m === 'Ctrl' ? ctrlName : m)), base].join('+');
}

// ---- 連続して押すキー（`G G`）。押したキーの控え。1 つめから 1 秒以内に次を押したときだけつながる ----

/** 連続のキーの、つながる間隔（ms） */
export const HOTKEY_SEQUENCE_MS = 1000;

type Pressed = { byCode: string; byKey: string | null; at: number };
let pressedLog: Pressed[] = [];
/** 控えに入れたイベント（同じイベントを、操作ごとに何度も照合するので、1 回だけ入れる） */
let loggedEvent: KeyEventLike | null = null;
/** 連続のキーに当たった直後（次のキーで、控えを空にする。同じイベントの照合は、当たったままにする） */
let clearLogNext = false;

/** 控えを空にする（試験・フォーカスが外れたとき） */
export function resetHotkeySequence(): void {
  pressedLog = [];
  loggedEvent = null;
  clearLogNext = false;
}

function record(e: KeyEventLike, o: Resolved): void {
  if (e === loggedEvent) return;
  // 押しっぱなしの繰り返しは、控えに入れない（長押しで `G G` に当たらないように）
  if ((e as { repeat?: boolean }).repeat) return;
  const byCode = keyFromEvent(e, o, false);
  // 修飾キーだけ・変換中は、つながりを切らない
  if (byCode === null) return;
  const now = Date.now();
  if (clearLogNext) {
    pressedLog = [];
    clearLogNext = false;
  }
  pressedLog = pressedLog.filter((p) => now - p.at <= HOTKEY_SEQUENCE_MS).slice(-7);
  pressedLog.push({ byCode, byKey: o.letters === 'key-then-code' ? keyFromEvent(e, o, true) : null, at: now });
  loggedEvent = e;
}

/** アプリ全体の、連続のキー（`G H`）の一覧。1 回のキー（`H`）より先に当てるために、使う側が登録する */
let registeredSequences: string[] = [];

/**
 * アプリで使っているキーのうち、連続のもの（空白を含むもの）を登録する。
 * 登録した連続のキーに、いま押したキーでつながるとき（`G` のあとの `H`）は、同じキーの 1 回のキー（`H`）には当てない。
 * 設定が変わるたびに、全部を渡し直す（空のものは無視する）
 */
export function registerHotkeySequences(keys: readonly string[]): void {
  registeredSequences = keys.filter((k) => k.includes(' '));
}

function tailMatches(w: string): boolean {
  const parts = w.split(' ');
  const tail = pressedLog.slice(-parts.length);
  return tail.length === parts.length && tail.every((p, i) => p.byCode === parts[i] || p.byKey === parts[i]);
}

function matches(e: KeyEventLike, keys: readonly string[], o: Resolved, sequences: boolean): boolean {
  if (sequences) record(e, o);
  const want = keys.map((k) => normalizeHotkey(k, o)).filter((k): k is string => k !== null);
  if (want.length === 0) return false;
  // 連続のキー: 控えの終わりが、このイベントのキー。1 回のキーより先に調べる
  if (sequences && loggedEvent === e) {
    for (const w of want) {
      if (w.includes(' ') && tailMatches(w)) {
        clearLogNext = true;
        return true;
      }
    }
  }
  // 登録した連続のキーにつながるなら、1 回のキーには当てない（`G H` を押したとき、`H` は働かない）
  if (sequences && loggedEvent === e) {
    for (const r of registeredSequences) {
      const n = normalizeHotkey(r, o);
      if (n !== null && tailMatches(n)) return false;
    }
  }
  const single = new Set(want.filter((k) => !k.includes(' ')));
  const byCode = keyFromEvent(e, o, false);
  if (byCode !== null && single.has(byCode)) return true;
  const byKey = o.letters === 'key-then-code' ? keyFromEvent(e, o, true) : null;
  return byKey !== null && single.has(byKey);
}

/**
 * イベントが、ホットキーのどれかに当たるか（letters: 'key-then-code' のときは、押した文字でも位置でも当たる）。
 * 連続のキー（`G G`）は、直前までに押したキー（この関数が見たもの）とつないで当てる
 */
export function matchesHotkey(e: KeyEventLike, keys: readonly string[], opts?: HotkeyOptions): boolean {
  return matches(e, keys, resolve(opts), true);
}

const SHOWN: Record<string, string> = { Mod: 'Ctrl', Mouse4: 'マウス戻る', Mouse5: 'マウス進む', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Escape: 'Esc', ' ': 'Space' };

/** 画面に出す形（`Alt+ArrowLeft` → `Alt+←`。`Mod` は `Ctrl`。連続のキーは `G → G`） */
export function formatHotkey(text: string): string {
  return text
    .split(' ')
    .map((chord) =>
      chord
        .split('+')
        .map((p) => SHOWN[p] ?? p)
        .join('+'),
    )
    .join(' → ');
}

/** 修飾キー（Ctrl・Alt、separate のときは Meta）を含まないか。文字を打っている途中（入力欄）では、このようなホットキーは働かせない */
export function isPlainHotkey(text: string, opts?: HotkeyOptions): boolean {
  const n = normalizeHotkey(text, opts);
  if (n === null) return false;
  // 連続のキーは、1 つめで決める
  const mods = n.split(' ')[0].split('+').slice(0, -1);
  return !mods.some((m) => m === 'Ctrl' || m === 'Alt' || m === 'Meta' || m === (opts?.ctrl ?? 'Ctrl'));
}

/**
 * 入力欄で文字を打っている最中に、このホットキーを働かせてよいか。修飾キー（Ctrl・Alt・Meta）を含むものは働く。
 * `functionKeys` のときは、F1〜F24 も働く（既定は、ふつうのキーと同じく止める）
 */
export function worksWhileTyping(text: string, opts?: HotkeyOptions & { functionKeys?: boolean }): boolean {
  if (!isPlainHotkey(text, opts)) return true;
  const n = normalizeHotkey(text, opts);
  return !!opts?.functionKeys && n !== null && /^F\d{1,2}$/.test(n);
}

/** Shift を押していても、押していないものとして当てる（矢印: Shift を押しながらは、選びに足す） */
export function matchesIgnoringShift(e: KeyEventLike, keys: readonly string[], opts?: HotkeyOptions): boolean {
  // 連続のキーは、見ない（控えにも入れない。矢印の 4 方向を続けて照合するので、入れると重なる）
  // プロパティを 1 つずつ写す（本物の KeyboardEvent は、展開（...e）しても、プロトタイプの値が写らない）
  const copy: KeyEventLike = { key: e.key, code: e.code, isComposing: e.isComposing, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, shiftKey: false };
  return matches(copy, keys, resolve(opts), false);
}
