# core（TypeScript の土台）

`@3pino/app-kit-web/core/<名前>` で読む。どれも DOM かブラウザーの API にだけ頼り、Svelte の部品は持たない（`/shell` の部品を除く）。

## 何がどこにあるか

| ファイル | 役目 | 注意 |
|---|---|---|
| `platform` | Rust（Tauri）が WebView に入れる OS の事実の読み方（`injectedPlatform`・`osName`・`isTauri`・`isAndroid`・`isLinuxDesktop`・`isDesktopWindowsOrLinuxTauri`） | グローバルの名前は `configurePlatform` で決める（下） |
| `storage` | `localStorage`・`sessionStorage` を包む（使えない環境で例外にしない）。`setItemOrThrow` は容量不足を呼び出し元へ返す | 直接の `localStorage` 利用は、アプリでこれだけに寄せる |
| `localKeys` | 登録された localStorage のキーの照合（`findRegisteredKey`） | 登録の表そのものはアプリが持つ |
| `nativeInvoke` | `invokeNative(plugin, cmd, args)` で Tauri のプラグインを呼ぶ | プラグイン名の型はアプリが決める（文字列） |
| `foreground` | ウィンドウに戻ったとき（focus・visibilitychange）に呼ぶ | 返り値で外す |
| `refreshGate` | 読み直しを最短の間隔で間引く | 失敗しても記録は残す |
| `semver` | 版の比較（`compareVersions`）。解釈できなければ null | `v` 付き・プレリリースを扱う |
| `escape` | Esc の順（上に開いているものを先に閉じる）の判定 | DOM の要素の有無は呼び出し側が渡す |
| `contextMenu` | WebView の右クリックのメニューを止める（入力欄の中は残す） | 文書全体で 1 回 |
| `externalLink` | Tauri で既定のブラウザーへ開くリンクの判定 | 同じオリジンと http(s) だけ |
| `viewport` | `--app-height`（キーボードで縮む高さ）・ピンチなどの拡大を止める | |
| `clipboard` | 文字列をクリップボードへ（Clipboard API が無ければ `execCommand`） | ユーザー操作の中から呼ぶ |
| `dropGuard` | ファイルのドロップで WebView が移動するのを止める | 文字のドロップは残す |
| `zoom` | 拡大・移動の計算（純粋関数。`clampView`・`pinchView`・`isDoubleTap` など） | 状態は持たない |
| `zoomGesture` | 要素にピンチ・ダブルタップ・Ctrl+ホイールを付ける（Svelte の action） | `zoom` を使う |
| `swipe` | 横のスワイプの判定（`swipeOffset`・`swipeTriggered`・`atScrollEnd`） | `@3pino/ui-kit-web/gesture` を使う |
| `backNav` | 戻る操作（Android の戻る・Alt+←）を、アプリの `back()` へつなぐ | 履歴の深さも渡す |
| `pasteSource` | 貼り付けの経路（Android の notifier か、Linux のネイティブか）を 1 回読んで返す | `platform` を使う |
| `index` | 上の全部を 1 つから読む（`@3pino/app-kit-web/core`） | 個別に読むほうが依存が小さい |

## アプリの接続

### 1. Rust の注入値の名前（platform）

Tauri の Rust 側が `window.<名前>` にデバイスの事実を入れる。その名前を、アプリの起動の最初に教える:

```ts
import { configurePlatform } from '@3pino/app-kit-web/core/platform';
configurePlatform({ globalName: '__MYAPP_PLATFORM__' }); // 既定は __APP_PLATFORM__
```

- 名前は `globalThis` の `Symbol.for` の枠に置くので、同じモジュールが二重に読まれても、どちらも同じ名前を見る。
- 注入が無い・形が違うときは、UA から推測する（`injectedPlatform()` は null）。
- disnans は `app/src/lib/platformGlobal.ts` で `__DISNANS_PLATFORM__` を指定する。

### 2. localStorage のキーの登録

アプリは、使うキーの一覧（名前・所有者・種類）を持ち、`findRegisteredKey(list, key)` で照合する。接頭辞（例: `myapp.`）は一覧の中に書く（`prefix: true` で始まりのキーを表す）。試験で「登録の無いキーを使っていない」を確かめるのは、アプリの側の仕事。

### 3. プラグインの呼び出し

`invokeNative('<プラグイン名>', '<コマンド>', args)`。`@tauri-apps/api/core` は初めて呼ぶときに読むので、Tauri 以外の環境で読んでも落ちない（呼べばエラー）。

### 4. 戻る操作

`startBackNav({ depth, back }, history, window)` を起動時に 1 回。`back()` が true を返した操作は、Android の戻るを奪う。`depth()` が 0 のときは、アプリを裏へ回す（呼び出し側の仕事）。

## 持っていない（アプリの側に残すもの）

- 送り主の表示・チャット・通話・設定・プラグインの仕組み・サーバーとの通信。
- Android のシステムバー（`plugin:system-bars`）・診断ログ（`disnans.diagLog`・notifier の Kotlin 側）: アプリごとの Tauri プラグインと結び付いているので、まだ移していない。
- 日付・サイズの書式（`format`）: 現在は `@3pino/explorer-kit` を使う。土台に入れると依存が増えるため、移していない。
- エラーの文言（`errors`）・Enter キーの動作（`enterKeys`）・画面の向き（`orientation`）・画面の遷移の履歴（`navHistory`）: アプリの言葉・形そのもの。
