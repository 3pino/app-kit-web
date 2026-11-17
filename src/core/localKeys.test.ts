import { describe, expect, it } from 'vitest';
import { findRegisteredKey } from './localKeys';

const RULES = [
  { key: 'app.a', scope: 'exact' },
  { key: 'app.plugin.', prefix: true as const, scope: 'prefix' },
  { key: 'app.plugin.special', scope: 'exact-over-prefix' },
];

describe('findRegisteredKey（登録の照合。登録の中身はアプリが持つ）', () => {
  it('完全一致', () => {
    expect(findRegisteredKey(RULES, 'app.a')?.scope).toBe('exact');
  });

  it('prefix で始まるキー', () => {
    expect(findRegisteredKey(RULES, 'app.plugin.x.data')?.scope).toBe('prefix');
  });

  it('完全一致の登録は prefix より先に当たる', () => {
    expect(findRegisteredKey(RULES, 'app.plugin.special')?.scope).toBe('exact-over-prefix');
  });

  it('prefix の無い登録は、前方一致では当たらない', () => {
    expect(findRegisteredKey(RULES, 'app.a.more')).toBeUndefined();
    expect(findRegisteredKey(RULES, 'other')).toBeUndefined();
  });
});
