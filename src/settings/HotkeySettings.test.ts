// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import HotkeySettings from './HotkeySettings.svelte';

// ホットキーの設定画面: 節は初めは折りたたみ。キーの追加（記録）・外す・既定に戻す・重なりの警告を、渡された関数で行う
let instance: ReturnType<typeof mount> | undefined;
afterEach(async () => {
  if (instance) await unmount(instance);
  instance = undefined;
  document.body.innerHTML = '';
});

const commands = [
  { id: 'new', name: '新規', group: 'ファイル' },
  { id: 'close', name: '閉じる', group: 'ファイル' },
  { id: 'back', name: '戻る', group: '移動' },
];

function setup(over: Partial<Parameters<typeof HotkeySettings>[1]> = {}) {
  const store: Record<string, string[]> = { new: ['Ctrl+N'], close: ['Ctrl+W'], back: ['Alt+ArrowLeft'] };
  const custom = new Set<string>();
  const spy = { add: vi.fn(), remove: vi.fn(), reset: vi.fn(), recording: vi.fn() };
  instance = mount(HotkeySettings, {
    target: document.body,
    props: {
      commands,
      groups: ['ファイル', '移動', '空の節'],
      keys: (id: string) => store[id] ?? [],
      isCustom: (id: string) => custom.has(id),
      conflicts: new Map(),
      add: (id: string, k: string) => {
        spy.add(id, k);
        store[id] = [...store[id], k];
      },
      remove: spy.remove,
      reset: spy.reset,
      onrecording: spy.recording,
      ...over,
    },
  });
  flushSync();
  return { spy, custom };
}

const toggles = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('.hotkey-group-toggle')];
const flush = async (): Promise<void> => {
  await Promise.resolve();
  flushSync();
};

describe('HotkeySettings', () => {
  it('節は、操作のある節だけ、初めは折りたたんで出す。見出しで開閉する', async () => {
    setup();
    expect(toggles().map((t) => t.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['ファイル 2', '移動 1']);
    expect(document.querySelectorAll('[data-command]')).toHaveLength(0);
    toggles()[0].click();
    await flush();
    expect([...document.querySelectorAll('[data-command]')].map((e) => (e as HTMLElement).dataset.command)).toEqual(['new', 'close']);
    expect(toggles()[0].getAttribute('aria-expanded')).toBe('true');
    toggles()[0].click();
    await flush();
    expect(document.querySelectorAll('[data-command]')).toHaveLength(0);
  });

  it('キーの外す・既定に戻すは、渡された関数を呼ぶ。変えていない操作の「戻す」は押せない', async () => {
    const { spy, custom } = setup();
    custom.add('close');
    toggles()[0].click();
    await flush();
    expect(document.querySelector<HTMLButtonElement>('button[aria-label="新規のキーを既定に戻す"]')!.disabled).toBe(true);
    document.querySelector<HTMLElement>('button[aria-label="新規の Ctrl+N を外す"]')!.click();
    expect(spy.remove).toHaveBeenCalledWith('new', 'Ctrl+N');
    document.querySelector<HTMLElement>('button[aria-label="閉じるのキーを既定に戻す"]')!.click();
    expect(spy.reset).toHaveBeenCalledWith('close');
  });

  it('「＋」で記録を始め、次のキーを足す（ほかへは渡さない）。もう一度「＋」で、やめる。Esc も記録する', async () => {
    const { spy } = setup();
    toggles()[0].click();
    await flush();
    const plus = (): HTMLElement => document.querySelector<HTMLElement>('button[aria-label="新規のキーを追加"]')!;
    plus().click();
    await flush();
    expect(document.querySelector('[data-command="new"]')!.textContent).toContain('キーを押してください');
    expect(spy.recording).toHaveBeenLastCalledWith(true);
    // 修飾キーだけは待つ
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(spy.add).not.toHaveBeenCalled();
    const ev = new KeyboardEvent('keydown', { key: 'y', code: 'KeyY', ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(ev);
    await flush();
    expect(ev.defaultPrevented).toBe(true);
    expect(spy.add).toHaveBeenCalledWith('new', 'Ctrl+Y');
    expect(spy.recording).toHaveBeenLastCalledWith(false);
    plus().click();
    await flush();
    plus().click();
    await flush();
    expect(document.querySelector('[data-command="new"]')!.textContent).not.toContain('キーを押してください');
    plus().click();
    await flush();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(spy.add).toHaveBeenLastCalledWith('new', 'Escape');
  });

  it('マウスの戻る・進むのボタンも記録できる。ほかのボタンは記録しない', async () => {
    const { spy } = setup();
    toggles()[0].click();
    await flush();
    document.querySelector<HTMLElement>('button[aria-label="閉じるのキーを追加"]')!.click();
    await flush();
    window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true, cancelable: true }));
    expect(spy.add).not.toHaveBeenCalled();
    const ev = new MouseEvent('mouseup', { button: 4, bubbles: true, cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(spy.add).toHaveBeenCalledWith('close', 'Mouse5');
  });

  it('同じキーが重なっていれば、双方の行に警告を出す。画面に出さない操作の名前は allNames で引く', async () => {
    setup({
      conflicts: new Map([['Ctrl+W', ['close', 'hidden']]]),
      allNames: (id: string) => (id === 'hidden' ? '隠れた操作' : (commands.find((c) => c.id === id)?.name ?? id)),
    });
    toggles()[0].click();
    await flush();
    expect(document.querySelector('[data-command="close"]')!.textContent).toContain('同じキーが、ほかの操作にもあります: Ctrl+W（隠れた操作）');
    expect(document.querySelector('[data-command="new"]')!.textContent).not.toContain('同じキー');
  });
});
