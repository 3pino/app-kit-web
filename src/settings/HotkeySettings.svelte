<script lang="ts" module>
  /** 画面に出す操作 1 つ */
  export interface HotkeyItem {
    id: string;
    name: string;
    /** 節の名前（`groups` のどれか） */
    group: string;
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
  import IconButton from '@3pino/ui-kit-web/IconButton.svelte';
  import SettingRow from '@3pino/ui-kit-web/SettingRow.svelte';
  import StatusLine from '@3pino/ui-kit-web/StatusLine.svelte';
  import { formatHotkey, hotkeyFromEvent, hotkeyFromMouse } from '../core/hotkeys';

  // 設定の「ホットキー」の画面: 操作ごとに、キーを複数決められる（追加・外す・既定に戻す）。
  // 何があるか（commands・groups）と、いまのキー・保存（keys・isCustom・add・remove・reset）は、使う側が渡す（保存先・既定は、アプリの決まり）。
  // 記録のあいだは、押したキーを、ほかの操作に渡さない（window の捕捉の段で止める。使う側にも onrecording で知らせる）。Esc も、ほかのキーと同じように記録できる。
  // 記録をやめるのは、もう一度「＋」を押す・ほかを押してフォーカスが外れる、とき。マウスの「戻る」「進む」のボタンも記録できる。
  // 節（まとまり）は、見出しを押して、開く・折りたたむ（初めは、折りたたんである）。

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
  }: {
    /** 画面に出す操作（この順。出さない操作は、渡さない） */
    commands: readonly HotkeyItem[];
    /** 節の並び */
    groups: readonly string[];
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
  } = $props();

  /** キーを記録している操作 */
  let recording = $state<string | null>(null);

  function onRecordKey(e: KeyboardEvent): void {
    const id = recording;
    if (!id) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.isComposing || e.keyCode === 229) return;
    const text = hotkeyFromEvent(e);
    // 修飾キーだけのときは、続けて押すキーを待つ
    if (!text) return;
    add(id, text);
    recording = null;
  }

  function onRecordMouse(e: MouseEvent): void {
    const id = recording;
    if (!id) return;
    const text = hotkeyFromMouse(e);
    if (!text) return;
    e.preventDefault();
    e.stopPropagation();
    add(id, text);
    recording = null;
  }

  $effect(() => {
    const on = recording !== null;
    // 知らせる処理は、使う側の状態を書く。この効果の依存にしない
    untrack(() => onrecording?.(on));
    if (!on) return;
    window.addEventListener('keydown', onRecordKey, true);
    window.addEventListener('mouseup', onRecordMouse, true);
    return () => {
      window.removeEventListener('keydown', onRecordKey, true);
      window.removeEventListener('mouseup', onRecordMouse, true);
    };
  });
  onDestroy(() => onrecording?.(false));

  /** 開いている節 */
  let opened = $state<Record<string, boolean>>({});

  const sections = $derived(groups.map((g) => ({ title: g, commands: commands.filter((c) => c.group === g) })).filter((s) => s.commands.length > 0));
  const nameOf = (id: string): string => allNames?.(id) ?? commands.find((c) => c.id === id)?.name ?? id;

  /** その操作のキーのうち、ほかの操作とも重なっているもの（警告に出す） */
  function clashes(id: string): string[] {
    const out: string[] = [];
    for (const [key, ids] of conflicts) {
      if (!ids.includes(id)) continue;
      out.push(`${formatHotkey(key)}（${ids.filter((x) => x !== id).map(nameOf).join('・')}）`);
    }
    return out;
  }
</script>

{#each sections as section (section.title)}
  {@const isOpen = opened[section.title] === true}
  <section class="setting-section">
    <Divider class="setting-section-divider" />
    <h2 class="setting-section-title hotkey-group-title">
      <button type="button" class="hotkey-group-toggle" aria-expanded={isOpen} onclick={() => (opened[section.title] = !isOpen)}>
        <ChevronRight size={16} class={isOpen ? 'hotkey-group-chevron hotkey-group-chevron-open' : 'hotkey-group-chevron'} />
        {section.title}
        <span class="muted hotkey-group-count">{section.commands.length}</span>
      </button>
    </h2>
    {#if isOpen}
      {#each section.commands as c (c.id)}
        {@const clash = clashes(c.id)}
        <div class="hotkey-command" data-command={c.id}>
          <SettingRow name={c.name} class="hotkey-row">
            {#snippet control()}
              {#each keys(c.id) as k (k)}
                <kbd class="kbd hotkey-chip">
                  {formatHotkey(k)}
                  <button type="button" class="hotkey-remove" aria-label={`${c.name}の ${formatHotkey(k)} を外す`} title="外す" onclick={() => remove(c.id, k)}><X size={12} /></button>
                </kbd>
              {:else}
                <span class="muted hotkey-none">なし</span>
              {/each}
              {#if recording === c.id}
                <span class="hotkey-recording" role="status">キーを押してください…</span>
              {/if}
              <IconButton
                class="hotkey-reset"
                label={`${c.name}のキーを既定に戻す`}
                title="既定に戻す"
                iconSize={16}
                disabled={!isCustom(c.id)}
                onclick={() => reset(c.id)}><RotateCcw size={16} /></IconButton
              >
              <IconButton
                class="hotkey-add"
                label={`${c.name}のキーを追加`}
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
            <StatusLine kind="warn" icon={TriangleAlert} class="hotkey-conflict">同じキーが、ほかの操作にもあります: {clash.join('、')}</StatusLine>
          {/if}
        </div>
      {/each}
    {/if}
  </section>
{/each}

<style>
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
