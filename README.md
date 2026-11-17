# @3pino/app-kit-web

3pino のアプリの土台（Svelte 5 / TypeScript）。プラットフォームの判定・ストレージ・Tauri のプラグインの呼び出し・画面の戻る操作・トースト・確認など、どのアプリでも同じ部分を置きます。[disnans](https://github.com/3pino/disnans)・[fixplor](https://github.com/3pino/fixplor) が使う予定です。

- **`@3pino/app-kit-web/core`（と `core/<名前>`）**: 画面に依らない TypeScript。DOM かブラウザーの API にだけ頼る。一覧と各モジュールの役目は [docs/core.md](docs/core.md)。
- **`@3pino/app-kit-web/shell`**: 画面の状態 `Shell`（トースト・確認・拡大表示・戻る操作の層）と、部品 `shell/Toasts.svelte`・`shell/ConfirmDialog.svelte`。[docs/shell.md](docs/shell.md)。

## 配り方

ソースのまま配ります（ビルド済みの JS は出しません）。取り込む側の Vite が、TypeScript と Svelte を変換します。

- 依存: `@3pino/design-system`（見た目）・`@3pino/ui-kit-web`（部品と gesture）・`svelte` ^5.57。`@tauri-apps/api` は Tauri の呼び出しを使うときだけ（任意）。
- 取り込むときは、アプリの `vite.config.ts` の `optimizeDeps.exclude` に入れる（事前バンドルは JS だけを想定するため）。
- 試験の vitest で `vi.mock` を効かせるなら、`server.deps.inline` に入れる。

## 使い方の要点

アプリは起動の最初に次を 1 回呼ぶ（詳しくは [docs/core.md](docs/core.md)）:

```ts
import { configurePlatform } from '@3pino/app-kit-web/core/platform';
configurePlatform({ globalName: '__MYAPP_PLATFORM__' }); // Rust が入れる注入値の名前（既定 __APP_PLATFORM__）
```

## 開発

```sh
npm install
npm run check   # svelte-check（型と Svelte）
npm test        # vitest（jsdom の部品の試験を含む）
```

依存の `@3pino/design-system` と `@3pino/ui-kit-web` は、開発では隣のリポジトリを `file:` で指しています（`package.json` の devDependencies）。公開のときは、タグの版に戻してください。

## 持たないもの

チャット・通話・設定・サーバーとの通信・プラグインの仕組み・アプリのエラーの文言など、アプリ固有の言葉と形は入れません。アプリの側に残すものと理由は docs/core.md の最後。

## ライセンス

MIT（[LICENSE](LICENSE)）。
