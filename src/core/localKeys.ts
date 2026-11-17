// localStorage のキーの登録の照合（土台）。どのキーがアプリの登録にあるかを決める。
// 登録の中身（キーの名前・所有者・種類）はアプリが持つ。接頭辞（例: "myapp."）もアプリの登録の中に書く。
// prefix: true の登録は、そのキーで始まるキー（動的なキー）を表す。完全一致の登録が先に当たる。

export type KeyRule = { key: string; prefix?: true };

/** キーに当たる登録（完全一致が先。無ければ、prefix で始まるもの）。登録が無ければ undefined */
export function findRegisteredKey<T extends KeyRule>(rules: readonly T[], key: string): T | undefined {
  return rules.find((k) => !k.prefix && k.key === key) ?? rules.find((k) => k.prefix && key.startsWith(k.key));
}
