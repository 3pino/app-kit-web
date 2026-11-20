import { normalizeHotkey } from './hotkeys';

// 操作ごとのホットキー（既定と、利用者が変えた分）の決まり。画面にも保存先にも依らない（保存は、使う側が `Overrides` を読み書きする）。
// 変えた分は、既定と違う操作だけを保存する（既定が変わったとき、変えていない操作は追従する）。

/** 操作 1 つ: ID と、既定のホットキー（空なら、キーを割り当てない） */
export interface HotkeyCommand<Id extends string = string> {
  id: Id;
  defaults: readonly string[];
}

/** 利用者が変えた分（操作の ID → いま効いているキーの並び。空の並びは「全部外した」） */
export type Overrides<Id extends string = string> = Partial<Record<Id, string[]>>;

/** 一覧が既定と同じなら、保存しない（null） */
export function overrideOf(defaults: readonly string[], list: readonly string[]): string[] | null {
  const d = defaults.map((k) => normalizeHotkey(k) ?? k);
  return list.length === d.length && list.every((k, i) => k === d[i]) ? null : [...list];
}

/** 一覧の最後に足す（すでに在れば、そのまま）。読めないキーは、そのまま返す */
export function addKey(list: readonly string[], key: string): string[] {
  const n = normalizeHotkey(key);
  return n === null || list.includes(n) ? [...list] : [...list, n];
}

export const removeKey = (list: readonly string[], key: string): string[] => list.filter((k) => k !== key);

/** 保存した文字から読む。壊れた値・知らない操作・読めないキーは捨てる（読めるものだけを残す） */
export function parseOverrides<Id extends string>(raw: string | null, commands: readonly HotkeyCommand<Id>[]): Overrides<Id> {
  if (raw === null) return {};
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return {};
  const ids = new Set<string>(commands.map((c) => c.id));
  const out: Overrides<Id> = {};
  for (const [id, list] of Object.entries(v)) {
    if (!ids.has(id) || !Array.isArray(list)) continue;
    const keys: string[] = [];
    for (const k of list) {
      const n = typeof k === 'string' ? normalizeHotkey(k) : null;
      if (n !== null && !keys.includes(n)) keys.push(n);
    }
    out[id as Id] = keys;
  }
  return out;
}

/** いま効いているホットキー（変えていなければ既定。全部外した操作は、空） */
export function effectiveKeys<Id extends string>(commands: readonly HotkeyCommand<Id>[], id: Id, over: Overrides<Id>): readonly string[] {
  return over[id] ?? commands.find((c) => c.id === id)?.defaults ?? [];
}

/** 同じキーを持つ操作（キー → 操作の ID の並び。2 つ以上のものだけ） */
export function findConflicts<Id extends string>(commands: readonly HotkeyCommand<Id>[], over: Overrides<Id>): Map<string, Id[]> {
  const by = new Map<string, Id[]>();
  for (const c of commands) {
    for (const k of effectiveKeys(commands, c.id, over)) {
      const n = normalizeHotkey(k) ?? k;
      by.set(n, [...(by.get(n) ?? []), c.id]);
    }
  }
  for (const [k, ids] of [...by]) if (ids.length < 2) by.delete(k);
  return by;
}
