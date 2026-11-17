# Rust / Tauri 側の共有（設計メモ。コードは未移動）

対象: disnans の `app/src-tauri/plugins/apk-updater`（約 2.5k 行）・`plugins/system-bars`（約 2.3k 行）・`src/os_drop*.rs`（約 1.2k 行）・`platform.rs`。

## 案

`3pino/tauri-kit` を 1 リポジトリの workspace にし、Rust の crate と、その Kotlin/gradle を plugin ごとに同梱する。

- crate: `apk-updater`・`system-bars`・`os-drop`・`platform`（名前は disnans 固有でないよう、plugin 識別子も見直す）
- crates.io には出さず、git 依存（タグ指定）で取り込む。JS 側（`@3pino/app-kit-web/updater` 等）と版を揃える。

## 理由

- JS 側の `UpdateBackend` / `os-drop` の口は、Tauri の plugin 名（`plugin:apk-updater|…`）に依存する。Rust と JS を別々に版上げすると、呼び出し名が合わなくなる。
- Android の Kotlin は gradle の依存を持つので、plugin ごとに閉じた形で置くのが安全。

## 入れる前に決めること（リスク）

1. plugin 識別子と permissions の名前（`apk-updater` など）を、共有の名前に変えるか。変えると既存のインストール済みの版の呼び出しが変わる（破壊的）。
2. 署名・リポジトリ（`3pino/disnans`）の設定化。updater の公開鍵・エンドポイントは、アプリごとに持つ。
3. `os_drop_walk`（約 850 行）は、テストごと移す。Linux・Windows の差は cfg で閉じる。
4. CI: Rust の依存（gstreamer など）が無い環境では、disnans の `app/src-tauri` を通せない（既存の制約）。tauri-kit 単体の CI は、この依存を含まない。
5. `platform.rs` の `__DISNANS_PLATFORM__` 注入は、JS の `configurePlatform` 側と名前を揃える必要がある（既に JS 側は設定可能）。

## 今はやらないこと

コードの移動は行わない。disnans 内の plugin はそのまま。JS 側の口（UpdateBackend・dropFiles の Tauri 呼び出し）だけ、先に土台へ移した。
