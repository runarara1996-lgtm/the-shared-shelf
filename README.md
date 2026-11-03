# The Shared Shelf — GitHub Pages版

The Shared Shelf is a small shared reading journal for two people. GitHub Pages hosts the website; Google Apps Script and a private Google Sheet store the journal data.

## ファイル

- `index.html` — GitHub Pagesに公開する画面
- `apps-script/Code.gs` — 既存Apps Scriptプロジェクトに反映するAPI対応版

## 現在の構成

- 画面: GitHub Pages
- 保存先: 非公開のGoogle Sheets
- 読み書きAPI: Apps Script Web App
- Supabase: not used by this version

The existing room data has already been copied into the private Sheet. The static page uses a read-only JSONP request to load it and `doPost` to save changes. The Supabase migration helper has been removed from this version.

## 公開手順

1. Replace `Code.gs` in the existing Apps Script project with `apps-script/Code.gs`. Keep its Script Property `BOOK_JOURNAL_SPREADSHEET_ID`; it points to the existing private Sheet. The existing `Index.html` can remain as a fallback.
2. Deploy a new version of the existing Apps Script Web App, keeping its `/exec` URL, execution as you, and access set to Anyone.
3. Enable GitHub Pages for this repository from the `main` branch and `/ (root)` folder.
4. Open the Pages URL with `?room=kyogo-kasia` and use that link on both devices.

## アクセスについて

The Apps Script Web App is available to anyone with its URL. Anyone who also knows the room ID can read and edit the journal. The Sheet stays private, but Apps Script usage limits still apply. Supabase is no longer part of the app's live read/write path.

The original Supabase data is left untouched as a backup.

