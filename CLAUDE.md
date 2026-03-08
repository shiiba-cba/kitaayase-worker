# CLAUDE.md

このファイルは、このリポジトリで作業する際の Claude Code (claude.ai/code) 向けのガイドを提供します。

## コマンド

```bash
npm run dev      # Wrangler でローカル開発サーバーを起動
npm run deploy   # Cloudflare Workers にデプロイ
npm test         # Vitest でテストを実行
npm run cf-typegen  # Wrangler 設定から Cloudflare 型を再生成
```

## アーキテクチャ

これは TypeScript を使用した Cloudflare Workers プロジェクトで、東京メトロ千代田線の運行情報を提供する API エンドポイントです。

**リクエストフロー (`src/index.ts`):**
1. Edge Cache にキャッシュされたレスポンスがないか確認
2. キャッシュミス場合、東京メトロ ODPT API を呼び出し
3. レスポンスをパースして正規化（ステータスを `normal`/`delay`/`suspended` にマッピング）
4. レスポンスを 30 秒間キャッシュ
5. CORS ヘッダー付きの JSON を返す

**主要ファイル:**
- `src/index.ts` - fetch ハンドラーを持つワーカーのエントリーポイント
- `wrangler.jsonc` - ワーカー設定（メインエントリー、バインディング、変数）
- `test/index.spec.ts` - `@cloudflare/vitest-pool-workers` を使用した Vitest テスト
- `.dev.vars` - ローカル開発用の環境変数（TOKYO_METRO_API_KEY）
- `worker-configuration.d.ts` - 自動生成された Cloudflare 型定義

**環境変数:**
- `TOKYO_METRO_API_KEY` - 東京メトロ API 認証に必要なバインディング

**テスト:**
Cloudflare Workers テストハーネスを使用し、`cloudflare:test` ユーティリティ（`env`、`SELF`、`createExecutionContext`）を利用。
