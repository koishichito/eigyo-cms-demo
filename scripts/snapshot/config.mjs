// ========================================
// hotel-pl-system.jp スナップショット設定
// ========================================

export const CONFIG = {
  // ログイン情報
  baseUrl: "https://hotel-pl-system.jp",
  loginPath: "/login",
  credentials: {
    email: "info@jnavi.co.jp",
    password: "jnavi1234",
  },

  // 出力先
  outputDir: "./snapshots",

  // リクエスト設定
  requestDelay: 1000, // ページ間の待機時間 (ms)
  timeout: 30000, // リクエストタイムアウト (ms)
  maxRetries: 3, // 最大リトライ回数

  // ユーザーエージェント
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};
