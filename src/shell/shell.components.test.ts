// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import Toasts from './Toasts.svelte';
import ConfirmDialog from './ConfirmDialog.svelte';
import ToastsHost from '../test-support/ToastsHost.svelte';
import { Shell, type ShellConfirm, type ShellToast } from './shell.svelte';

let instance: ReturnType<typeof mount> | undefined;
let target: HTMLElement | undefined;
afterEach(async () => {
  if (instance) await unmount(instance);
  target?.remove();
  instance = undefined;
  target = undefined;
});

function attach(): HTMLElement {
  target = document.createElement('div');
  document.body.appendChild(target);
  return target;
}

describe('Toasts（土台の通知の並び）', () => {
  it('通知を出し、閉じるボタンで dismiss を呼ぶ（id 付き）', () => {
    const toasts: ShellToast<string>[] = [{ id: 7, text: 'こんにちは', kind: 'info' }];
    const dismiss = vi.fn();
    instance = mount(Toasts, { target: attach(), props: { toasts, dismiss } });
    flushSync();
    expect(target!.querySelector('.toast-text')?.textContent).toBe('こんにちは');
    (target!.querySelector('.toast-close') as HTMLButtonElement).click();
    expect(dismiss).toHaveBeenCalledWith(7);
  });

  it('error は toast-error の印、action は実行してから閉じる', () => {
    const run = vi.fn();
    const toasts: ShellToast<string>[] = [{ id: 1, text: 'x', kind: 'error', action: { label: '直す', run } }];
    const dismiss = vi.fn();
    instance = mount(Toasts, { target: attach(), props: { toasts, dismiss } });
    flushSync();
    expect(target!.querySelector('.toast')?.classList.contains('toast-error')).toBe(true);
    (target!.querySelector('.toast-action') as HTMLButtonElement).click();
    expect(run).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledWith(1);
  });

  it('送り主（avatar）が無ければ、アバターの枠を出さない。あれば avatar の snippet で描く', () => {
    const toasts: ShellToast<string>[] = [
      { id: 1, text: 'a', kind: 'info' },
      { id: 2, text: 'b', kind: 'info', avatar: 'bob' },
    ];
    instance = mount(ToastsHost, { target: attach(), props: { toasts, dismiss: () => {} } });
    flushSync();
    expect(target!.querySelectorAll('.toast-avatar').length).toBe(1);
    expect(target!.querySelector('.toast-avatar .host-avatar')?.textContent).toBe('bob');
  });

  it('通知が無ければ何も出さない', () => {
    instance = mount(Toasts, { target: attach(), props: { toasts: [], dismiss: () => {} } });
    flushSync();
    expect(target!.querySelectorAll('.toast').length).toBe(0);
  });
});

describe('ConfirmDialog（土台の確認）', () => {
  it('要求が無ければ何も出さない', () => {
    instance = mount(ConfirmDialog, { target: attach(), props: { request: null } });
    flushSync();
    expect(target!.querySelector('.confirm-dialog-ok')).toBeNull();
  });

  it('要求があれば、OK は true・キャンセルは false で resolve する（Shell の confirm と組み合わせ）', async () => {
    const shell = new Shell();
    const p = shell.confirm({ title: '消しますか', body: '元に戻せません', okLabel: '消す', ngLabel: 'やめる', danger: true });
    instance = mount(ConfirmDialog, { target: attach(), props: { request: shell.confirmReq as ShellConfirm | null } });
    flushSync();
    expect(target!.querySelector('.confirm-dialog-message')?.textContent).toBe('元に戻せません');
    (target!.querySelector('.confirm-dialog-cancel') as HTMLButtonElement).click();
    await expect(p).resolves.toBe(false);
  });

  it('OK で true', async () => {
    const shell = new Shell();
    const p = shell.confirm({ title: 'x', okLabel: 'はい' });
    instance = mount(ConfirmDialog, { target: attach(), props: { request: shell.confirmReq as ShellConfirm | null } });
    flushSync();
    (target!.querySelector('.confirm-dialog-ok') as HTMLButtonElement).click();
    await expect(p).resolves.toBe(true);
  });
});
