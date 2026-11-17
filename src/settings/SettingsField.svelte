<script lang="ts">
  import SettingRow from '@3pino/ui-kit-web/SettingRow.svelte';
  import SegmentedButton from '@3pino/ui-kit-web/SegmentedButton.svelte';
  import Slider from '@3pino/ui-kit-web/Slider.svelte';
  import Toggle from '@3pino/ui-kit-web/Toggle.svelte';
  import type { SettingBinding, SettingControl } from './types';

  // 設定の 1 項目（SettingRow + 部品）。部品の種類は control が決め、値は binding で読み書きする。
  // 読み書きの先（どの設定・どのストア）はアプリが決めて渡す。binding が null なら何も出さない。

  let {
    label,
    icon = undefined,
    rowClass = '',
    binding,
    spec,
  }: {
    label: string;
    icon?: string | undefined;
    rowClass?: string;
    binding: SettingBinding | null;
    /** 部品の種類と選択肢（control は、行の中の操作の欄の名前と紛れるので spec） */
    spec: SettingControl;
  } = $props();
</script>

{#if binding}
  <SettingRow name={label} {icon} class={rowClass}>
    {#snippet control()}
      {@const c = spec}
      {#if c.type === 'toggle'}
        <Toggle checked={!!binding.get()} {label} onchange={(on) => binding.set(on)} />
      {:else if c.type === 'segmented'}
        <SegmentedButton
          class="settings-field-picker"
          {label}
          options={c.options.map((o) => ({ value: o.value, label: o.label, icon: o.icon ?? undefined }))}
          value={String(binding.get())}
          onchange={(v) => binding.set(v)}
        />
      {:else if c.type === 'select'}
        <select class="input settings-field-select" aria-label={label} value={String(binding.get())} onchange={(e) => binding.set(e.currentTarget.value)}>
          {#each c.options as o (o.value)}
            <option value={o.value}>{o.label}</option>
          {/each}
        </select>
      {:else}
        <Slider
          {label}
          min={c.min}
          max={c.max}
          step={c.step}
          value={Math.round(Number(binding.get()) * c.scale)}
          format={(v) => `${v}${c.unit}`}
          oninput={(v) => (binding.preview ?? binding.set)(v / c.scale)}
          onchange={(v) => binding.set(v / c.scale)}
        />
      {/if}
    {/snippet}
  </SettingRow>
{/if}

<style>
  /* 横に並んだ選択肢は、窮屈にならない幅で並べる（行が狭いときは、行の折り返しで操作が下の段へ回る） */
  :global(.settings-field-segmented .setting-row-control) {
    width: 264px;
  }
  /* SettingRow は操作を div で包むので、その div も幅いっぱいにする */
  :global(.settings-field-segmented .setting-row-control > div) {
    flex: 1;
    min-width: 0;
  }
  :global(.settings-field-picker) {
    width: 100%;
  }
  /* 選択（.input の幅いっぱいにせず、中身の幅に合わせる） */
  .settings-field-select {
    width: auto;
    max-width: 260px;
  }
</style>
