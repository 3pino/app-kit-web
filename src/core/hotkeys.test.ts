import { describe, expect, it } from 'vitest';
import { worksWhileTyping } from './hotkeys';
import { formatHotkey, hotkeyFromEvent, hotkeyFromMouse, isPlainHotkey, matchesHotkey, matchesIgnoringShift, matchesMouse, normalizeHotkey } from './hotkeys';

const ev = (key: string, init: Partial<Parameters<typeof hotkeyFromEvent>[0]> = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...init });

describe('hotkeyFromEvent', () => {
  it('修飾キーは Ctrl・Alt・Shift の順。Cmd（Meta）は Ctrl として扱う', () => {
    expect(hotkeyFromEvent(ev('t', { ctrlKey: true }))).toBe('Ctrl+T');
    expect(hotkeyFromEvent(ev('t', { metaKey: true }))).toBe('Ctrl+T');
    expect(hotkeyFromEvent(ev('Tab', { shiftKey: true, ctrlKey: true }))).toBe('Ctrl+Shift+Tab');
    expect(hotkeyFromEvent(ev('ArrowLeft', { altKey: true }))).toBe('Alt+ArrowLeft');
    expect(hotkeyFromEvent(ev('F5'))).toBe('F5');
    expect(hotkeyFromEvent(ev(' '))).toBe('Space');
  });
  it('英数字は、Shift・配列に依らず、キーの位置（code）で決める', () => {
    expect(hotkeyFromEvent(ev('!', { code: 'Digit1', shiftKey: true }))).toBe('Shift+1');
    expect(hotkeyFromEvent(ev('ü', { code: 'KeyY', ctrlKey: true }))).toBe('Ctrl+Y');
  });
  it('修飾キーだけ・変換中は null', () => {
    expect(hotkeyFromEvent(ev('Control', { ctrlKey: true }))).toBeNull();
    expect(hotkeyFromEvent(ev('Shift', { shiftKey: true }))).toBeNull();
    expect(hotkeyFromEvent(ev('a', { isComposing: true }))).toBeNull();
  });
});

describe('normalizeHotkey・matchesHotkey', () => {
  it('書き方の違いをそろえる。読めないものは null', () => {
    expect(normalizeHotkey('shift+ctrl+tab')).toBe('Ctrl+Shift+Tab');
    expect(normalizeHotkey('Cmd+t')).toBe('Ctrl+T');
    expect(normalizeHotkey('esc')).toBe('Escape');
    expect(normalizeHotkey('Ctrl++')).toBe('Ctrl++');
    expect(normalizeHotkey('')).toBeNull();
    expect(normalizeHotkey('Hyper+X')).toBeNull();
    expect(normalizeHotkey('Ctrl')).toBeNull();
  });
  it('どれかに当たれば真。修飾キーが違えば偽', () => {
    expect(matchesHotkey(ev('w', { ctrlKey: true }), ['Ctrl+W'])).toBe(true);
    expect(matchesHotkey(ev('w', { ctrlKey: true, shiftKey: true }), ['Ctrl+W'])).toBe(false);
    expect(matchesHotkey(ev('PageDown', { ctrlKey: true }), ['Ctrl+Tab', 'ctrl+pagedown'])).toBe(true);
    expect(matchesHotkey(ev('x'), [])).toBe(false);
  });
});

describe('formatHotkey・isPlainHotkey', () => {
  it('画面に出す形と、修飾キーなしの判定', () => {
    expect(formatHotkey('Alt+ArrowLeft')).toBe('Alt+←');
    expect(formatHotkey('Escape')).toBe('Esc');
    expect(isPlainHotkey('F2')).toBe(true);
    expect(isPlainHotkey('Shift+A')).toBe(true);
    expect(isPlainHotkey('Ctrl+F')).toBe(false);
    expect(isPlainHotkey('Alt+ArrowLeft')).toBe(false);
  });
});

describe('matchesIgnoringShift', () => {
  it('Shift を押していても、押していないキーとして当てる。Ctrl・Alt は区別する', () => {
    expect(matchesIgnoringShift(ev('ArrowUp', { shiftKey: true }), ['ArrowUp'])).toBe(true);
    expect(matchesIgnoringShift(ev('ArrowUp'), ['ArrowUp'])).toBe(true);
    expect(matchesIgnoringShift(ev('ArrowUp', { ctrlKey: true }), ['ArrowUp'])).toBe(false);
  });
});

describe('マウスの戻る・進むのボタン', () => {
  const m = (button: number, init: Partial<Parameters<typeof hotkeyFromMouse>[0]> = {}) => ({ button, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...init });
  it('4 番目（button 3）は Mouse4、5 番目（button 4）は Mouse5。ほかのボタンは対象外。修飾キーも付く', () => {
    expect(hotkeyFromMouse(m(3))).toBe('Mouse4');
    expect(hotkeyFromMouse(m(4))).toBe('Mouse5');
    expect(hotkeyFromMouse(m(0))).toBeNull();
    expect(hotkeyFromMouse(m(1))).toBeNull();
    expect(hotkeyFromMouse(m(3, { ctrlKey: true, shiftKey: true }))).toBe('Ctrl+Shift+Mouse4');
  });
  it('書いたホットキーの文字は、そろえて比べる。キーボードの操作とは当たらない', () => {
    expect(normalizeHotkey('mouse4')).toBe('Mouse4');
    expect(normalizeHotkey('ctrl+MOUSE5')).toBe('Ctrl+Mouse5');
    expect(matchesMouse(m(3), ['Alt+ArrowLeft', 'mouse4'])).toBe(true);
    expect(matchesMouse(m(4), ['Mouse4'])).toBe(false);
    expect(matchesHotkey(ev('Mouse4'), ['Mouse4'])).toBe(true);
    expect(formatHotkey('Mouse4')).toBe('マウス戻る');
    expect(formatHotkey('Ctrl+Mouse5')).toBe('Ctrl+マウス進む');
  });
});

// ---- オプション（HotkeyOptions）。既定は上の試験のまま ----
const DISNANS = { meta: 'separate', ctrl: 'Mod', letters: 'key-then-code', plus: 'Plus' } as const;

describe('HotkeyOptions: Meta を別の修飾キーにする（separate）', () => {
  it('Meta は Ctrl と別に書く。並びは Mod・Meta・Alt・Shift', () => {
    expect(hotkeyFromEvent(ev('t', { metaKey: true }), { meta: 'separate' })).toBe('Meta+T');
    expect(hotkeyFromEvent(ev('t', { ctrlKey: true, metaKey: true, altKey: true, shiftKey: true }), { meta: 'separate' })).toBe('Ctrl+Meta+Alt+Shift+T');
    expect(normalizeHotkey('Cmd+t', { meta: 'separate' })).toBe('Meta+T');
    expect(normalizeHotkey('Cmd+t')).toBe('Ctrl+T');
  });
  it('Meta だけのホットキーは、Ctrl のものに当たらない（当たるのは Meta のイベントだけ）', () => {
    const o = { meta: 'separate' } as const;
    expect(matchesHotkey(ev('w', { metaKey: true }), ['Meta+W'], o)).toBe(true);
    expect(matchesHotkey(ev('w', { ctrlKey: true }), ['Meta+W'], o)).toBe(false);
    expect(matchesHotkey(ev('w', { metaKey: true }), ['Ctrl+W'], o)).toBe(false);
    // 既定（fold）では、Meta と Ctrl が同じ
    expect(matchesHotkey(ev('w', { metaKey: true }), ['Ctrl+W'])).toBe(true);
  });
});

describe('HotkeyOptions: Ctrl を Mod と書く（ctrl: "Mod"）', () => {
  it('記録・正規化は Mod と書く。書き方の違う Ctrl も Mod にそろえる', () => {
    expect(hotkeyFromEvent(ev('s', { ctrlKey: true }), { ctrl: 'Mod' })).toBe('Mod+S');
    expect(normalizeHotkey('ctrl+shift+s', { ctrl: 'Mod' })).toBe('Mod+Shift+S');
    expect(normalizeHotkey('Mod+Shift+S', { ctrl: 'Mod' })).toBe('Mod+Shift+S');
    expect(formatHotkey('Mod+Shift+S')).toBe('Ctrl+Shift+S');
  });
});

describe('HotkeyOptions: 英字は押した文字でも当てる（letters: "key-then-code"）', () => {
  it('押した文字（Dvorak など）でも、キーの位置（code）でも当たる。どちらでもなければ当たらない', () => {
    const o = { letters: 'key-then-code' } as const;
    // Dvorak: 位置 KeyD の物理キーが文字 e を出す
    expect(matchesHotkey({ key: 'e', code: 'KeyD', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }, ['Ctrl+D'], o)).toBe(true);
    // 文字 D を押す（QWERTY でも、Shift+D は D）
    expect(matchesHotkey({ key: 'D', code: 'KeyD', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true }, ['Ctrl+Shift+D'], o)).toBe(true);
    expect(matchesHotkey({ key: 'x', code: 'KeyX', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }, ['Ctrl+D'], o)).toBe(false);
    // 既定（code のみ）では、文字 e の位置が KeyD でも当たらない
    expect(matchesHotkey({ key: 'e', code: 'KeyD', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }, ['Ctrl+D'])).toBe(true);
    expect(matchesHotkey({ key: 'd', code: 'KeyE', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }, ['Ctrl+D'])).toBe(false);
  });
});

describe('HotkeyOptions: + を Plus と書く（plus: "Plus"）', () => {
  it('記録・正規化は Plus。既定の `Ctrl++` は変えない', () => {
    expect(hotkeyFromEvent(ev('+', { ctrlKey: true, code: 'Equal' }), { plus: 'Plus' })).toBe('Ctrl+Plus');
    expect(normalizeHotkey('Ctrl++', { plus: 'Plus' })).toBe('Ctrl+Plus');
    expect(normalizeHotkey('Ctrl+plus', { plus: 'Plus' })).toBe('Ctrl+Plus');
    expect(normalizeHotkey('Ctrl++')).toBe('Ctrl++');
    expect(normalizeHotkey('Ctrl+Plus')).toBe('Ctrl+Plus');
  });
});

describe('HotkeyOptions: 入力欄で打っている間に働かせるか（worksWhileTyping）', () => {
  it('Ctrl・Alt・Meta（separate のとき）を含むものは働く。F キーは functionKeys で働く', () => {
    expect(worksWhileTyping('Ctrl+B', DISNANS)).toBe(true);
    expect(worksWhileTyping('Meta+B', DISNANS)).toBe(true);
    expect(worksWhileTyping('Alt+ArrowLeft', DISNANS)).toBe(true);
    expect(worksWhileTyping('Shift+A', DISNANS)).toBe(false);
    expect(worksWhileTyping('A', DISNANS)).toBe(false);
    expect(worksWhileTyping('F2', DISNANS)).toBe(false);
    expect(worksWhileTyping('F2', { ...DISNANS, functionKeys: true })).toBe(true);
    expect(worksWhileTyping('Shift+F2', { functionKeys: true })).toBe(false);
    expect(worksWhileTyping('Shift+A', { functionKeys: true })).toBe(false);
  });
  it('既定（fold）では Meta は Ctrl と同じ。既定の isPlainHotkey は変えない', () => {
    expect(isPlainHotkey('Meta+B')).toBe(false);
    expect(isPlainHotkey('Meta+B', { meta: 'separate' })).toBe(false);
    expect(isPlainHotkey('Shift+A', { meta: 'separate' })).toBe(true);
    expect(isPlainHotkey('F2', { meta: 'separate' })).toBe(true);
    expect(isPlainHotkey('Mod+B', { ctrl: 'Mod' })).toBe(false);
  });
});

describe('HotkeyOptions: 全部そろえた場合（アプリの決まり）', () => {
  it('記録した文字は、そのまま正規化される（保存したものを読み直しても変わらない）', () => {
    const t = hotkeyFromEvent(ev('x', { ctrlKey: true, metaKey: true, shiftKey: true, code: 'KeyX' }), DISNANS);
    expect(t).toBe('Mod+Meta+Shift+X');
    expect(normalizeHotkey(t!, DISNANS)).toBe(t);
    expect(hotkeyFromEvent(ev(' ', { altKey: true, code: 'Space' }), DISNANS)).toBe('Alt+Space');
    expect(hotkeyFromEvent(ev('Escape', { code: 'Escape' }), DISNANS)).toBe('Escape');
  });
});
