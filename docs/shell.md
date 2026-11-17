# shell（画面の土台の状態と部品）

`@3pino/app-kit-web/shell` と `@3pino/app-kit-web/shell/Toasts.svelte`・`@3pino/app-kit-web/shell/ConfirmDialog.svelte`。

## Shell（状態）

`new Shell<送り主の型, 拡大表示の型>()`。チャット・通話・設定・サーバーを知らない。持つもの:

- **トースト**: `toast(text, kind?, action?, ms = 5000, avatar?)` は id を返す。`ms` が null なら dismiss まで残る。`dismiss(id)`。
- **確認**: `confirm({ title, body?, okLabel, ngLabel?, danger? })` は `Promise<boolean>`。`confirmReq` に開いている要求がある（`ConfirmDialog` に渡す）。
- **拡大表示**: `openLightbox(item, gallery?)`。`lightbox` は今の 1 枚、`lightboxGallery` は前後の一覧（呼ぶたびに取り直す）。
- **戻る操作の層**: `addPluginBack(run)` は外すための関数を返す。`back(nav)` は「拡大表示 → 層（新しい順）→ `nav()`」の順に 1 つ戻す。`backDepth(navDepth)` は戻れる回数。

`nav` は呼び出し側の遷移の履歴（タブ・パネルなど）。Shell は履歴を持たないので、アプリが遷移を決める。

## Toasts.svelte

```svelte
<Toasts toasts={shell.toasts} dismiss={(id) => shell.dismiss(id)}>
  {#snippet avatar(a)}<MyAvatar value={a} />{/snippet}
</Toasts>
```

- 通知の見た目（上端の中央・error の帯・操作ボタン・閉じるボタン）は土台。色と間隔は design-system のトークン。
- 送り主の表示は、`avatar` の snippet で渡す（無い通知は枠も出さない）。
- 操作（action）は、実行してから閉じる。

## ConfirmDialog.svelte

```svelte
<ConfirmDialog request={shell.confirmReq} />
```

- 「キャンセル」は `ngLabel`（省くと既定の文字）。`danger` で OK ボタンを危険の色にする。
- 閉じる・キャンセルは false、OK は true で resolve する。

## アプリの接続（例: disnans）

- アプリの `ui` は `Shell` を 1 つ持ち、トーストや確認の呼び出しを委ねる（呼び出し側の書き方を変えないため）。
- disnans の `Toasts.svelte` は、`ui.toasts` と送り主のアイコン（チャットの AuthorAvatar）を渡すだけの薄いラッパー。
- 拡大表示の部品（Lightbox）・戻る操作の全体・設定の枠は、まだ土台に移していない（次の段）。
