// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
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

// ---- 文言・振る舞いの選び方（options）・節なし・行の追加（rowExtra） ----

describe('HotkeySettings の選び方', () => {
  const flat = [
    { id: 'new', name: '新規', description: '文書を作る' },
    { id: 'close', name: '閉じる' },
  ];
  function mountWith(over: Record<string, unknown>, props: Record<string, unknown> = {}) {
    const store: Record<string, string[]> = { new: ['Ctrl+N'], close: [] };
    const spy = { add: vi.fn(), remove: vi.fn(), reset: vi.fn(), recording: vi.fn() };
    instance = mount(HotkeySettings, {
      target: document.body,
      props: {
        commands: flat,
        keys: (id: string) => store[id] ?? [],
        isCustom: () => false,
        conflicts: new Map(),
        add: (id: string, k: string) => {
          spy.add(id, k);
          store[id] = [...(store[id] ?? []), k];
        },
        remove: spy.remove,
        reset: spy.reset,
        onrecording: spy.recording,
        ...over,
      },
    });
    flushSync();
    return { spy };
  }
  const addBtn = (name: string) => document.querySelector<HTMLElement>(`button[aria-label="${name}のキーを追加"], button[aria-label="${name} のホットキーを追加"]`);

  it('節を渡さなければ、節の見出しを作らず、操作を並べて出す（説明も出す）', async () => {
    mountWith({});
    expect(document.querySelectorAll('.hotkey-group-toggle')).toHaveLength(0);
    expect([...document.querySelectorAll('[data-command]')].map((e) => (e as HTMLElement).dataset.command)).toEqual(['new', 'close']);
    expect(document.querySelector('[data-command="new"]')!.textContent).toContain('文書を作る');
  });

  it('文言は labels・conflictText で変えられる。既定の文言は変わらない', async () => {
    const { spy } = mountWith(
      {
        conflicts: new Map([['Ctrl+N', ['new', 'x']]]),
        allNames: (id: string) => (id === 'x' ? '隠れた' : (flat.find((c) => c.id === id)?.name ?? id)),
        options: {
          labels: { add: (n: string) => `${n} のホットキーを追加`, remove: (n: string, k: string) => `${n} から ${k} を外す` },
          conflictText: (cl: { key: string; names: string[] }[]) => `「${cl[0].names.join('」「')}」と同じキーです`,
        },
      },
    );
    expect(addBtn('新規')).not.toBeNull();
    expect(document.querySelector('button[aria-label="新規 から Ctrl+N を外す"]')).not.toBeNull();
    expect(document.querySelector('[data-command="new"]')!.textContent).toContain('「隠れた」と同じキーです');
    addBtn('新規')!.click();
    await flush();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', code: 'KeyY', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(spy.add).toHaveBeenCalledWith('new', 'Ctrl+Y');
  });

  it('既定の文言（options なし）は、これまでと同じ', () => {
    mountWith({ conflicts: new Map([['Ctrl+N', ['new', 'x']]]), allNames: () => '隠れた' });
    expect(document.querySelector('[data-command="new"]')!.textContent).toContain('同じキーが、ほかの操作にもあります: Ctrl+N（隠れた）');
    expect(document.querySelector('button[aria-label="新規のキーを追加"]')).not.toBeNull();
  });

  it('escapeCancels のとき、修飾キーなしの Esc は記録を取り消す（追加しない）', async () => {
    const { spy } = mountWith({ options: { escapeCancels: true } });
    addBtn('新規')!.click();
    await flush();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await flush();
    expect(spy.add).not.toHaveBeenCalled();
    expect(document.querySelector('[data-command="new"]')!.textContent).not.toContain('キーを押してください');
    // 修飾キー付きの Esc は、ふつうに記録する
    addBtn('新規')!.click();
    await flush();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(spy.add).toHaveBeenCalledWith('new', 'Ctrl+Escape');
  });

  it('mouse: false のとき、マウスの戻る・進むは記録しない', async () => {
    const { spy } = mountWith({ options: { mouse: false } });
    addBtn('新規')!.click();
    await flush();
    window.dispatchEvent(new MouseEvent('mouseup', { button: 3, bubbles: true, cancelable: true }));
    expect(spy.add).not.toHaveBeenCalled();
  });

  it('hotkeys（Mod・Meta）で、記録する文字の書き方が変わる', async () => {
    const { spy } = mountWith({ hotkeys: { ctrl: 'Mod', meta: 'separate', plus: 'Plus' } });
    addBtn('新規')!.click();
    await flush();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', code: 'KeyY', ctrlKey: true, metaKey: true, bubbles: true, cancelable: true }));
    expect(spy.add).toHaveBeenCalledWith('new', 'Mod+Meta+Y');
  });

  it('rowExtra は操作の行の下に、操作ごとに出す', () => {
    const extra = createRawSnippet((c: () => HotkeyItemLike) => ({
      render: () => `<div class="extra-row">付け足し:${c().id}</div>`,
    }));
    mountWith({ rowExtra: extra });
    expect(document.querySelector('[data-command="new"] .extra-row')!.textContent).toBe('付け足し:new');
    expect(document.querySelector('[data-command="close"] .extra-row')!.textContent).toBe('付け足し:close');
  });
});

type HotkeyItemLike = { id: string };

// ---- 連続して押すキーの記録・検索欄 ----

describe('HotkeySettings: sequences・search', () => {
  const items = [
    { id: 'new', name: '新規', description: '文書を作る', group: 'ファイル' },
    { id: 'close', name: '閉じる', group: 'ファイル' },
    { id: 'back', name: '戻る', group: '移動' },
  ];
  function mountWith(options: Record<string, unknown>) {
    const store: Record<string, string[]> = { new: ['Ctrl+N'], close: ['Ctrl+W'], back: ['Alt+ArrowLeft'] };
    const spy = { add: vi.fn() };
    instance = mount(HotkeySettings, {
      target: document.body,
      props: {
        commands: items,
        groups: ['ファイル', '移動'],
        keys: (id: string) => store[id] ?? [],
        isCustom: () => false,
        conflicts: new Map(),
        add: (id: string, k: string) => {
          spy.add(id, k);
          store[id] = [...(store[id] ?? []), k];
        },
        remove: vi.fn(),
        reset: vi.fn(),
        options,
      },
    });
    flushSync();
    return { spy };
  }
  const press = (k: string, code = `Key${k.toUpperCase()}`): void => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, code, bubbles: true, cancelable: true }));
  };
  const type = async (el: HTMLInputElement, text: string): Promise<void> => {
    el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
  };

  const dialog = (): HTMLElement | null => document.querySelector('[role="dialog"]');
  const seq = (): string[] => [...document.querySelectorAll('.hotkey-rec-chord')].map((e) => e.textContent?.trim() ?? '');
  const btn = (text: string): HTMLButtonElement => [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((b) => b.textContent?.trim() === text)!;
  const keyup = (k: string): void => {
    window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true, cancelable: true }));
  };
  async function open(label: string): Promise<void> {
    document.querySelector<HTMLElement>('.hotkey-group-toggle')!.click();
    await flush();
    document.querySelector<HTMLElement>(`button[aria-label="${label}のキーを追加"]`)!.click();
    await flush();
  }

  it('sequences: ダイアログに押したキーが順に並び、「記録終了」を押すまで確定しない（時間では確定しない）', async () => {
    vi.useFakeTimers();
    try {
      const { spy } = mountWith({ sequences: true });
      await open('新規');
      expect(dialog()).not.toBeNull();
      expect(btn('記録終了').disabled).toBe(true);
      press('g');
      vi.advanceTimersByTime(5000);
      press('g');
      await flush();
      expect(seq()).toEqual(['G', 'G']);
      expect(spy.add).not.toHaveBeenCalled();
      btn('記録終了').click();
      await flush();
      expect(spy.add).toHaveBeenCalledWith('new', 'G G');
      expect(dialog()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('sequences: 押しっぱなしの繰り返しは足さない。「キャンセル」・ダイアログの外・「＋」で、記録せずに閉じる。マウスの戻る・進むも足せる', async () => {
    const { spy } = mountWith({ sequences: true });
    await open('閉じる');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', code: 'KeyX', bubbles: true, cancelable: true }));
    for (let i = 0; i < 10; i++) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', code: 'KeyX', repeat: true, bubbles: true, cancelable: true }));
    await flush();
    expect(seq()).toEqual(['X']);
    window.dispatchEvent(new MouseEvent('mouseup', { button: 4, bubbles: true, cancelable: true }));
    await flush();
    expect(seq()).toEqual(['X', 'マウス進む']);
    btn('キャンセル').click();
    await flush();
    expect(dialog()).toBeNull();
    expect(spy.add).not.toHaveBeenCalled();
    // 外を押しても閉じる
    document.querySelector<HTMLElement>('button[aria-label="閉じるのキーを追加"]')!.click();
    await flush();
    document.querySelector<HTMLElement>('.modal-scrim')!.click();
    await flush();
    expect(dialog()).toBeNull();
    expect(spy.add).not.toHaveBeenCalled();
  });

  it('sequences: Enter・Esc は、短く押せばキーとして記録し、長押し（0.6 秒）で「記録終了」「キャンセル」になる', async () => {
    vi.useFakeTimers();
    try {
      const { spy } = mountWith({ sequences: true });
      await open('新規');
      press('k');
      // 短い Enter: キー Enter として足す
      press('Enter', 'Enter');
      vi.advanceTimersByTime(100);
      keyup('Enter');
      await flush();
      expect(seq()).toEqual(['K', 'Enter']);
      // 長い Enter: 確定
      press('Enter', 'Enter');
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(150);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', repeat: true, bubbles: true, cancelable: true }));
      }
      await flush();
      expect(spy.add).toHaveBeenCalledWith('new', 'K Enter');
      expect(dialog()).toBeNull();
      keyup('Enter');
      // 長い Esc: キャンセル（短い Esc は、キーとして足す）
      document.querySelector<HTMLElement>('button[aria-label="新規のキーを追加"]')!.click();
      await flush();
      press('Escape', 'Escape');
      vi.advanceTimersByTime(100);
      keyup('Escape');
      await flush();
      expect(seq()).toEqual(['Esc']);
      press('Escape', 'Escape');
      vi.advanceTimersByTime(700);
      await flush();
      expect(dialog()).toBeNull();
      expect(spy.add).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('sequences を渡さなければ、これまでどおり、押したときにすぐ記録する', async () => {
    const { spy } = mountWith({});
    document.querySelector<HTMLElement>('.hotkey-group-toggle')!.click();
    await flush();
    document.querySelector<HTMLElement>('button[aria-label="新規のキーを追加"]')!.click();
    await flush();
    press('g');
    expect(spy.add).toHaveBeenCalledWith('new', 'G');
  });

  it('search: を渡さないと検索欄は出ない。あるとき、名前・説明・キー（画面の形も）で絞り、絞っているあいだは節をすべて開く', async () => {
    mountWith({});
    expect(document.querySelector('.hotkey-search')).toBeNull();
    await unmount(instance!);
    document.body.innerHTML = '';
    mountWith({ search: true });
    const input = document.querySelector<HTMLInputElement>('.hotkey-search input')!;
    expect(document.querySelectorAll('[data-command]')).toHaveLength(0); // 節は折りたたみ
    await type(input, '戻');
    expect([...document.querySelectorAll('[data-command]')].map((e) => (e as HTMLElement).dataset.command)).toEqual(['back']);
    await type(input, 'ctrl');
    expect([...document.querySelectorAll('[data-command]')].map((e) => (e as HTMLElement).dataset.command)).toEqual(['new', 'close']);
    await type(input, '←'); // 画面に出す形（Alt+←）
    expect([...document.querySelectorAll('[data-command]')].map((e) => (e as HTMLElement).dataset.command)).toEqual(['back']);
    await type(input, 'ctrl 作る'); // 語を組み合わせる（すべてを含む）
    expect([...document.querySelectorAll('[data-command]')].map((e) => (e as HTMLElement).dataset.command)).toEqual(['new']);
    await type(input, 'ない言葉');
    expect(document.querySelector('.hotkey-no-hit')?.textContent).toContain('見つかりません');
    await type(input, '');
    expect(document.querySelectorAll('[data-command]')).toHaveLength(0);
    expect(document.querySelector('.hotkey-no-hit')).toBeNull();
  });
});
