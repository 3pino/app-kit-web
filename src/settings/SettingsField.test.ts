// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import SettingsField from './SettingsField.svelte';

// 部品の枠: binding が無ければ何も出さず、あれば名前付きの行を出す（部品の種類は control で決まる）
let instance: ReturnType<typeof mount> | undefined;
afterEach(async () => {
  if (instance) await unmount(instance);
  instance = undefined;
  document.body.innerHTML = '';
});

describe('SettingsField（項目の部品）', () => {
  it('binding が null なら、何も出さない', () => {
    instance = mount(SettingsField, { target: document.body, props: { label: '音', binding: null, spec: { type: 'toggle' } } });
    flushSync();
    expect(document.querySelector('.setting-row')).toBeNull();
  });

  it('toggle は binding の値を映し、切り替えで set を呼ぶ', () => {
    const calls: unknown[] = [];
    instance = mount(SettingsField, {
      target: document.body,
      props: { label: '通知', binding: { get: () => true, set: (v) => calls.push(v) }, spec: { type: 'toggle' } },
    });
    flushSync();
    const sw = document.querySelector<HTMLInputElement>('input[type="checkbox"], [role="switch"]');
    expect(sw, 'トグルがある').not.toBeNull();
    sw!.click();
    flushSync();
    expect(calls).toEqual([false]);
  });

  it('select は選択肢を出し、変更で set に値を渡す', () => {
    const calls: unknown[] = [];
    instance = mount(SettingsField, {
      target: document.body,
      props: {
        label: '向き',
        binding: { get: () => 'a', set: (v) => calls.push(v) },
        spec: { type: 'select', options: [{ value: 'a', label: 'A', icon: null }, { value: 'b', label: 'B', icon: null }] },
      },
    });
    flushSync();
    const sel = document.querySelector<HTMLSelectElement>('select')!;
    expect(sel.getAttribute('aria-label')).toBe('向き');
    expect(sel.options).toHaveLength(2);
    sel.value = 'b';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
    expect(calls).toEqual(['b']);
  });
});
