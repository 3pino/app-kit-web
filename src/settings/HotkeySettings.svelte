<script lang="ts" module>
  import type { IconRef } from '@3pino/ui-kit-web/icons';

  /** 画面に出す操作 1 つ */
  export interface HotkeyItem {
    id: string;
    name: string;
    /** 節の名前（`groups` を渡したときは必須。渡さないときは使わない） */
    group?: string;
    /** 名前の下に出す説明（省くと出さない） */
    description?: string;
    /** 名前の左に出すアイコン（省くと出さない） */
    icon?: IconRef;
  }

  /** 画面の文言・振る舞いの選び方（省くと既定。既定は、この画面が最初からしていたこと） */
  export interface HotkeyScreenOptions {
    /** マウスの「戻る」「進む」のボタンを記録するか（既定 true） */
    mouse?: boolean;
    /** 修飾キーなしの Esc で記録を取り消すか（既定 false。false のときは Esc もキーとして記録する） */
    escapeCancels?: boolean;
    /** ボタンの名前（既定: 「○○のキーを追加」「○○のキーを既定に戻す」「○○の Ctrl+X を外す」） */
    labels?: {
      add?: (name: string) => string;
      reset?: (name: string) => string;
      remove?: (name: string, key: string) => string;
    };
    /** 連続して押すキー（`G G`）を記録できるか（既定 false。true のときは、1 つめのキーのあと 0.7 秒、次のキーを待つ。次を押すとつながり、押さなければ 1 回のキーとして記録する。使う側の照合は core/hotkeys の matchesHotkey） */
    sequences?: boolean;
    /** 一覧の上に、操作の名前・説明・キーで絞る検索欄を出すか（既定 false。絞っているあいだは、節をすべて開く） */
    search?: boolean;
    /** 重なりの警告の文（clashes は、この操作のキーごとに、ぶつかっている操作の名前）。省くと既定の文 */
    conflictText?: (clashes: { key: string; names: string[] }[]) => string;
  }
</script>

<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Plus from '@lucide/svelte/icons/plus';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import X from '@lucide/svelte/icons/x';
  import Divider from '@3pino/ui-kit-web/Divider.svelte';
  import TextInput from '@3pino/ui-kit-web/TextInput.svelte';
  import IconButton from '@3pino/ui-kit-web/IconButton.svelte';
  import SettingRow from '@3pino/ui-kit-web/SettingRow.svelte';
  import StatusLine from '@3pino/ui-kit-web/StatusLine.svelte';
  import type { Snippet } from 'svelte';
  import { formatHotkey, hotkeyFromEvent, hotkeyFromMouse, normalizeHotkey, type HotkeyOptions } from '../core/hotkeys';

  // 設定の「ホットキー」の画面: 操作ごとに、キーを複数決められる（追加・外す・既定に戻す）。
  // 何があるか（commands・groups）と、いまのキー・保存（keys・isCustom・add・remove・reset）は、使う側が渡す（保存先・既定は、アプリの決まり）。
  // 記録のあいだは、押したキーを、ほかの操作に渡さない（window の捕捉の段で止める。使う側にも onrecording で知らせる）。Esc も、ほかのキーと同じように記録できる。
  // 記録をやめるのは、もう一度「＋」を押す・ほかを押してフォーカスが外れる、とき。マウスの「戻る」「進む」のボタンも記録できる。
  // 節（まとまり）は、見出しを押して、開く・折りたたむ（初めは、折りたたんである）。`groups` を渡さなければ、節を作らず、ひとつの並びで出す。
  // ホットキーの決まり（Meta の扱い・Ctrl の書き方など）は `hotkeys`（core/hotkeys の HotkeyOptions）で渡す。

  let {
    commands,
    groups,
    allNames,
    keys,
    isCustom,
    conflicts,
    add,
    remove,
    reset,
    onrecording,
    hotkeys,
    options,
    rowExtra,
  }: {
    /** 画面に出す操作（この順。出さない操作は、渡さない） */
    commands: readonly HotkeyItem[];
    /** 節の並び（省くと、節を作らず、ひとつの並びで出す） */
    groups?: readonly string[];
    /** 重なりの警告に出す、操作の名前（画面に出さない操作も含む）。省けば、commands から引く */
    allNames?: (id: string) => string;
    /** いま効いているキー */
    keys: (id: string) => readonly string[];
    /** 既定から変えているか（「既定に戻す」を押せるか） */
    isCustom: (id: string) => boolean;
    /** 同じキーを持つ操作（キー → 操作の ID の並び。2 つ以上のもの） */
    conflicts: ReadonlyMap<string, readonly string[]>;
    add: (id: string, key: string) => void;
    remove: (id: string, key: string) => void;
    reset: (id: string) => void;
    /** キーの記録を始めた・やめた（記録のあいだは、使う側のホットキーを働かせない） */
    onrecording?: (recording: boolean) => void;
    /** キーの決まり（省くと既定） */
    hotkeys?: HotkeyOptions;
    /** この画面の文言・振る舞い（省くと既定） */
    options?: HotkeyScreenOptions;
    /** 操作の行の下に、操作ごとの内容を足す（例: スラッシュコマンドの名前の編集）。行の中の操作は変えない */
    rowExtra?: Snippet<[HotkeyItem]>;
  } = $props();

  const mouseOn = $derived(options?.mouse ?? true);
  const escapeCancels = $derived(options?.escapeCancels ?? false);
  const labelAdd = (name: string) => options?.labels?.add?.(name) ?? `${name}のキーを追加`;
  const labelReset = (name: string) => options?.labels?.reset?.(name) ?? `${name}のキーを既定に戻す`;
  const labelRemove = (name: string, key: string) => options?.labels?.remove?.(name, key) ?? `${name}の ${formatHotkey(key)} を外す`;
  const conflictTextOf = (clashes: { key: string; names: string[] }[]) =>
    options?.conflictText?.(clashes) ??
    `同じキーが、ほかの操作にもあります: ${clashes.map((c) => `${formatHotkey(c.key)}（${c.names.join('・')}）`).join('、')}`;

  const sequencesOn = $derived(options?.sequences ?? false);
  const searchOn = $derived(options?.search ?? false);
  /** 連続のキーの、次のキーを待つ時間（ms）。つながる間隔（HOTKEY_SEQUENCE_MS）より短くする */
  const COMMIT_WAIT_MS = 700;

  /** キーを記録している操作 */
  let recording = $state<string | null>(null);
  /** ここまでに押したキー（連続のキー。次を待っているあいだ） */
  let pending = $state<string[]>([]);
  let commitTimer: ReturnType<typeof setTimeout> | undefined;

  /** 押したキーを足して、確定する（連続を記録するときは、少し待ってから） */
  function take(id: string, chord: string, immediate: boolean): void {
    if (!sequencesOn || immediate) {
      add(id, [...pending, chord].join(' '));
      pending = [];
      recording = null;
      return;
    }
    pending = [...pending, chord];
    clearTimeout(commitTimer);
    commitTimer = setTimeout(() => {
      const text = pending.join(' ');
      pending = [];
      if (recording === id) {
        add(id, text);
        recording = null;
      }
    }, COMMIT_WAIT_MS);
  }

  function onRecordKey(e: KeyboardEvent): void {
    const id = recording;
    if (!id) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.isComposing || e.keyCode === 229) return;
    if (escapeCancels && e.key === 'Escape' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      recording = null;
      return;
    }
    const text = hotkeyFromEvent(e, hotkeys);
    // 修飾キーだけのときは、続けて押すキーを待つ
    if (!text) return;
    take(id, text, false);
  }

  function onRecordMouse(e: MouseEvent): void {
    const id = recording;
    if (!id) return;
    const text = hotkeyFromMouse(e, hotkeys);
    if (!text) return;
    e.preventDefault();
    e.stopPropagation();
    // マウスのボタンで、すぐに確定する
    take(id, text, true);
  }

  $effect(() => {
    const on = recording !== null;
    // 知らせる処理は、使う側の状態を書く。この効果の依存にしない
    untrack(() => onrecording?.(on));
    if (!on) {
      clearTimeout(commitTimer);
      untrack(() => (pending = []));
      return;
    }
    window.addEventListener('keydown', onRecordKey, true);
    if (mouseOn) window.addEventListener('mouseup', onRecordMouse, true);
    return () => {
      window.removeEventListener('keydown', onRecordKey, true);
      if (mouseOn) window.removeEventListener('mouseup', onRecordMouse, true);
    };
  });
  onDestroy(() => {
    clearTimeout(commitTimer);
    onrecording?.(false);
  });

  /** 開いている節 */
  let opened = $state<Record<string, boolean>>({});

  // 検索: 名前・説明・キー（「ctrl」「→」など、画面に出す形でも、書いた形でも）に、空白で区切った語すべてを含むもの
  let query = $state('');
  const needles = $derived(query.trim().toLowerCase().split(/\s+/).filter(Boolean));
  const filtering = $derived(searchOn && needles.length > 0);
  function haystack(c: HotkeyItem): string {
    const ks = keys(c.id).flatMap((k) => [k, formatHotkey(k), normalizeHotkey(k, hotkeys) ?? '']);
    return [c.name, c.description ?? '', ...ks].join('\n').toLowerCase();
  }
  const shown = $derived(filtering ? commands.filter((c) => needles.every((n) => haystack(c).includes(n))) : commands);
  const sections = $derived(
    groups ? groups.map((g) => ({ title: g, commands: shown.filter((c) => c.group === g) })).filter((s) => s.commands.length > 0) : [],
  );
  const nameOf = (id: string): string => allNames?.(id) ?? commands.find((c) => c.id === id)?.name ?? id;

  /** その操作のキーのうち、ほかの操作とも重なっているもの（警告に出す） */
  function clashesOf(id: string): { key: string; names: string[] }[] {
    const out: { key: string; names: string[] }[] = [];
    for (const [key, ids] of conflicts) {
      if (!ids.includes(id)) continue;
      out.push({ key, names: ids.filter((x) => x !== id).map(nameOf) });
    }
    return out;
  }
</script>

{#snippet row(c: HotkeyItem)}
  {@const clash = clashesOf(c.id)}
  <div class="hotkey-command" data-command={c.id}>
    <SettingRow name={c.name} description={c.description} icon={c.icon} class="hotkey-row">
      {#snippet control()}
        {#each keys(c.id) as k (k)}
          <kbd class="kbd hotkey-chip">
            {formatHotkey(k)}
            <button type="button" class="hotkey-remove" aria-label={labelRemove(c.name, k)} title="外す" onclick={() => remove(c.id, k)}><X size={12} /></button>
          </kbd>
        {:else}
          <span class="muted hotkey-none">なし</span>
        {/each}
        {#if recording === c.id}
          <span class="hotkey-recording" role="status">{pending.length > 0 ? `${formatHotkey(pending.join(' '))} → …` : 'キーを押してください…'}</span>
        {/if}
        <IconButton
          class="hotkey-reset"
          label={labelReset(c.name)}
          title="既定に戻す"
          iconSize={16}
          disabled={!isCustom(c.id)}
          onclick={() => reset(c.id)}><RotateCcw size={16} /></IconButton
        >
        <IconButton
          class="hotkey-add"
          label={labelAdd(c.name)}
          title={recording === c.id ? '記録をやめる' : 'キーを追加'}
          active={recording === c.id}
          onclick={() => (recording = recording === c.id ? null : c.id)}
          onblur={() => {
            if (recording === c.id) recording = null;
          }}><Plus size={16} /></IconButton
        >
      {/snippet}
    </SettingRow>
    {#if clash.length > 0}
      <StatusLine kind="warn" icon={TriangleAlert} class="hotkey-conflict">{conflictTextOf(clash)}</StatusLine>
    {/if}
    {@render rowExtra?.(c)}
  </div>
{/snippet}

{#if searchOn}
  <div class="hotkey-search">
    <TextInput type="search" bind:value={query} placeholder="操作やキーで検索" aria-label="ホットキーを検索" autocomplete="off" spellcheck={false} />
  </div>
  {#if filtering && shown.length === 0}
    <p class="muted hotkey-no-hit">見つかりません</p>
  {/if}
{/if}

{#if groups}
  {#each sections as section (section.title)}
    {@const isOpen = filtering || opened[section.title] === true}
    <section class="setting-section">
      <Divider class="setting-section-divider" />
      <h2 class="setting-section-title hotkey-group-title">
        <button type="button" class="hotkey-group-toggle" aria-expanded={isOpen} onclick={() => (opened[section.title] = !(opened[section.title] === true))} disabled={filtering}>
          <ChevronRight size={16} class={isOpen ? 'hotkey-group-chevron hotkey-group-chevron-open' : 'hotkey-group-chevron'} />
          {section.title}
          <span class="muted hotkey-group-count">{section.commands.length}</span>
        </button>
      </h2>
      {#if isOpen}
        {#each section.commands as c (c.id)}
          {@render row(c)}
        {/each}
      {/if}
    </section>
  {/each}
{:else}
  {#each shown as c (c.id)}
    {@render row(c)}
  {/each}
{/if}

<style>
  .hotkey-search {
    padding: var(--space-3) 0;
  }
  .hotkey-no-hit {
    padding: var(--space-3) 0;
  }
  .hotkey-group-title {
    margin: 0;
  }
  /* 見出しの全体が、開く・閉じるのボタン */
  .hotkey-group-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-2) 0;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .hotkey-group-toggle :global(.hotkey-group-chevron) {
    flex: none;
    transition: transform 0.15s ease;
  }
  .hotkey-group-toggle :global(.hotkey-group-chevron-open) {
    transform: rotate(90deg);
  }
  .hotkey-group-count {
    font-size: var(--fs-sm);
    font-weight: normal;
  }
  .hotkey-command > :global(.hotkey-conflict) {
    margin-top: var(--space-2);
    font-size: var(--fs-sm);
  }
  /* 行の右にキーを並べる。各キーの中の × で外す */
  .hotkey-command :global(.hotkey-row .setting-row-control) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-2);
  }
  .hotkey-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }
  .hotkey-remove {
    display: inline-grid;
    place-items: center;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    cursor: pointer;
    opacity: 0.7;
  }
  .hotkey-remove:hover {
    opacity: 1;
  }
  .hotkey-none,
  .hotkey-recording {
    font-size: var(--fs-sm);
  }
  /* 記録中は、キーを待っていることがわかるようにアクセントの色にする */
  .hotkey-recording {
    color: var(--accent);
  }
  /* 押せないときは隠す（位置はそろえたまま） */
  .hotkey-command :global(.hotkey-reset:disabled) {
    visibility: hidden;
  }
</style>
