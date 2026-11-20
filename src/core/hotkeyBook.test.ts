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
