import { describe, expect, it } from 'vitest';
import { addKey, effectiveKeys, findConflicts, overrideOf, parseOverrides, removeKey, type HotkeyCommand } from './hotkeyBook';

const commands: HotkeyCommand[] = [
  { id: 'a', defaults: ['Ctrl+T'] },
  { id: 'b', defaults: ['Ctrl+W', 'F4'] },
  { id: 'c', defaults: [] },
];

describe('parseOverrides', () => {
  it('壊れた値・知らない操作・読めないキーは捨て、読めるものだけ残す（正規化し、重複も除く）', () => {
    expect(parseOverrides(null, commands)).toEqual({});
    expect(parseOverrides('{', commands)).toEqual({});
    expect(parseOverrides('[]', commands)).toEqual({});
    expect(parseOverrides(JSON.stringify({ a: ['ctrl+y', 'Ctrl+Y', 'x+y+', 3], z: ['F1'], b: 'F1' }), commands)).toEqual({ a: ['Ctrl+Y'] });
    expect(parseOverrides(JSON.stringify({ b: [] }), commands)).toEqual({ b: [] });
  });
});

describe('effectiveKeys・overrideOf', () => {
  it('変えていなければ既定。全部外せば空。既定と同じ並びなら保存しない', () => {
    expect(effectiveKeys(commands, 'a', {})).toEqual(['Ctrl+T']);
    expect(effectiveKeys(commands, 'a', { a: [] })).toEqual([]);
    expect(effectiveKeys(commands, 'c', {})).toEqual([]);
    expect(overrideOf(['Ctrl+T'], ['Ctrl+T'])).toBeNull();
    expect(overrideOf(['ctrl+t'], ['Ctrl+T'])).toBeNull();
    expect(overrideOf(['Ctrl+T'], ['Ctrl+T', 'Ctrl+Y'])).toEqual(['Ctrl+T', 'Ctrl+Y']);
    expect(overrideOf(['Ctrl+T'], [])).toEqual([]);
  });
});

describe('addKey・removeKey', () => {
  it('足すのは最後。すでに在れば足さない。読めないキーは、そのまま', () => {
    expect(addKey(['Ctrl+T'], 'ctrl+y')).toEqual(['Ctrl+T', 'Ctrl+Y']);
    expect(addKey(['Ctrl+T'], 'Ctrl+T')).toEqual(['Ctrl+T']);
    expect(addKey(['Ctrl+T'], '')).toEqual(['Ctrl+T']);
    expect(removeKey(['Ctrl+T', 'F4'], 'F4')).toEqual(['Ctrl+T']);
  });
});

describe('findConflicts', () => {
  it('同じキーを持つ操作だけを返す（変えた分も数える）', () => {
    expect(findConflicts(commands, {})).toEqual(new Map());
    expect(findConflicts(commands, { c: ['Ctrl+T', 'F4'] })).toEqual(
      new Map([
        ['Ctrl+T', ['a', 'c']],
        ['F4', ['b', 'c']],
      ]),
    );
  });
});

describe('HotkeyOptions を渡したとき（アプリの決まり）', () => {
  const o = { meta: 'separate', ctrl: 'Mod', plus: 'Plus' } as const;
  it('保存の読み書きは書き方（Mod・Meta）を保つ。並びは Mod・Meta・Alt・Shift', () => {
    expect(parseOverrides(JSON.stringify({ a: ['Mod+Meta+Shift+Y', 'mod+y', 'Meta+Plus'], b: ['Ctrl+W'] }), commands, o)).toEqual({
      a: ['Mod+Meta+Shift+Y', 'Mod+Y', 'Meta+Plus'],
      b: ['Mod+W'],
    });
  });
  it('既定と同じかは、書き方が違っても比べる。Meta と Ctrl は別', () => {
    expect(overrideOf(['Mod+T'], ['Ctrl+T'], o)).toBeNull();
    expect(overrideOf(['Mod+T'], ['Meta+T'], o)).toEqual(['Meta+T']);
    expect(addKey(['Mod+T'], 'Meta+T', o)).toEqual(['Mod+T', 'Meta+T']);
    expect(addKey(['Mod+T'], 'ctrl+t', o)).toEqual(['Mod+T']);
    expect(removeKey(['Mod+T', 'Meta+T'], 'Mod+T', o)).toEqual(['Meta+T']);
  });
  it('重なりは、Meta と Ctrl を別のキーとして見る', () => {
    const cs: HotkeyCommand[] = [
      { id: 'a', defaults: ['Mod+T'] },
      { id: 'b', defaults: ['Meta+T'] },
    ];
    expect(findConflicts(cs, {}, o).size).toBe(0);
    expect(findConflicts(cs, {}).get('Ctrl+T')).toEqual(['a', 'b']);
  });
});

describe('既定のときの removeKey（書き方の違いも外す）', () => {
  it('同じキーを、書き方が違っても外す', () => {
    expect(removeKey(['Ctrl+T', 'F2'], 'ctrl+t')).toEqual(['F2']);
  });
});
