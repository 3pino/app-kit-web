<script lang="ts">
  // 試験用: 送り主の snippet を渡す Toasts（avatar の描き方を確かめる）
  import Toasts from '../shell/Toasts.svelte';
  import type { ShellToast } from '../shell/shell.svelte';

  let { toasts, dismiss }: { toasts: ShellToast<string>[]; dismiss: (id: number) => void } = $props();
</script>

<Toasts {toasts} {dismiss}>
  {#snippet avatar(name: string)}
    <b class="host-avatar">{name}</b>
  {/snippet}
</Toasts>
