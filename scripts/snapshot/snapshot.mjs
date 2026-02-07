#!/usr/bin/env node
// ========================================
// hotel-pl-system.jp データベーススナップショット
//
// 使い方:
//   node scripts/snapshot/snapshot.mjs
//
// 出力:
//   ./snapshots/YYYY-MM-DD_HHmmss/ に JSON ファイルとして保存
// ========================================

import fs from "node:fs";
import path from "node:path";
import { CONFIG } from "./config.mjs";
import { HttpClient } from "./http-client.mjs";
import {
  extractNavLinks,
  extractTables,
  extractForms,
  extractCardData,
  extractLists,
  extractTitle,
  extractMainContent,
} from "./parser.mjs";

// ========================================
// メイン処理
// ========================================

async function main() {
  console.log("=".repeat(60));
  console.log("  hotel-pl-system.jp データベーススナップショット");
  console.log("=".repeat(60));
  console.log();

  const client = new HttpClient();
  const timestamp = formatTimestamp(new Date());
  const outputDir = path.resolve(CONFIG.outputDir, timestamp);
  fs.mkdirSync(outputDir, { recursive: true });

  const snapshot = {
    meta: {
      url: CONFIG.baseUrl,
      timestamp: new Date().toISOString(),
      user: CONFIG.credentials.email,
    },
    pages: {},
  };

  // ステップ 1: ログインページを取得してフォーム構造を確認
  console.log("[1/4] ログインページを取得中...");
  const loginPageResult = await discoverAndLogin(client);
  if (!loginPageResult.success) {
    console.error("ログインに失敗しました。設定を確認してください。");
    console.error("詳細:", loginPageResult.error);
    // ログインページの HTML を保存して調査用に
    fs.writeFileSync(
      path.join(outputDir, "_login_page.html"),
      loginPageResult.html || "N/A"
    );
    process.exit(1);
  }
  console.log("  => ログイン成功！");
  console.log();

  // ステップ 2: ナビゲーションからページ一覧を取得
  console.log("[2/4] ページ一覧を検出中...");
  const dashboardHtml = loginPageResult.dashboardHtml;
  const navLinks = extractNavLinks(dashboardHtml, CONFIG.baseUrl);

  // ダッシュボードのパスも追加
  const pagesToVisit = new Set([
    loginPageResult.dashboardPath || "/",
    ...navLinks,
  ]);

  // ログイン関連、アセット、ログアウトを除外
  const excludePatterns = [
    /login/i,
    /logout/i,
    /signout/i,
    /sign.out/i,
    /\.css$/i,
    /\.js$/i,
    /\.png$/i,
    /\.jpg$/i,
    /\.svg$/i,
    /\.ico$/i,
    /\.pdf$/i,
    /^\/$/,
  ];
  const filteredPages = Array.from(pagesToVisit).filter(
    (p) => !excludePatterns.some((re) => re.test(p))
  );

  console.log(`  => ${filteredPages.length} ページ検出`);
  for (const p of filteredPages) {
    console.log(`     - ${p}`);
  }
  console.log();

  // ステップ 3: 各ページを巡回してデータを抽出
  console.log("[3/4] 各ページからデータを抽出中...");

  // まずダッシュボードを処理
  const dashboardData = extractPageData(dashboardHtml, loginPageResult.dashboardPath || "/dashboard");
  snapshot.pages["dashboard"] = dashboardData;
  savePageData(outputDir, "dashboard", dashboardData, dashboardHtml);
  console.log(`  [✓] ダッシュボード - テーブル: ${dashboardData.tables.length}, カード: ${dashboardData.cards.length}`);

  // 残りのページを巡回
  for (const pagePath of filteredPages) {
    const pageName = pagePath.replace(/^\//, "").replace(/\//g, "_") || "root";
    try {
      await sleep(CONFIG.requestDelay);
      const res = await client.get(pagePath);
      if (res.status >= 400) {
        console.log(`  [✗] ${pagePath} (HTTP ${res.status})`);
        continue;
      }

      const pageData = extractPageData(res.body, pagePath);
      snapshot.pages[pageName] = pageData;
      savePageData(outputDir, pageName, pageData, res.body);

      console.log(
        `  [✓] ${pagePath} - テーブル: ${pageData.tables.length}, カード: ${pageData.cards.length}`
      );

      // ページ内にページネーションがあれば追加取得
      await fetchPaginatedData(client, res.body, pagePath, pageName, outputDir, snapshot);
    } catch (err) {
      console.log(`  [✗] ${pagePath}: ${err.message}`);
    }
  }
  console.log();

  // ステップ 4: スナップショットを保存
  console.log("[4/4] スナップショットを保存中...");

  // 全体サマリーを保存
  fs.writeFileSync(
    path.join(outputDir, "_snapshot.json"),
    JSON.stringify(snapshot, null, 2),
    "utf-8"
  );

  // テーブルデータだけの CSV 互換 JSON
  const allTables = {};
  for (const [pageName, pageData] of Object.entries(snapshot.pages)) {
    if (pageData.tables.length > 0) {
      allTables[pageName] = pageData.tables;
    }
  }
  fs.writeFileSync(
    path.join(outputDir, "_all_tables.json"),
    JSON.stringify(allTables, null, 2),
    "utf-8"
  );

  // サマリー
  const totalTables = Object.values(snapshot.pages).reduce(
    (sum, p) => sum + p.tables.length,
    0
  );
  const totalRows = Object.values(snapshot.pages).reduce(
    (sum, p) => sum + p.tables.reduce((s, t) => s + t.rowCount, 0),
    0
  );

  console.log();
  console.log("=".repeat(60));
  console.log("  スナップショット完了！");
  console.log("=".repeat(60));
  console.log(`  保存先:        ${outputDir}`);
  console.log(`  取得ページ数:  ${Object.keys(snapshot.pages).length}`);
  console.log(`  テーブル数:    ${totalTables}`);
  console.log(`  データ行数:    ${totalRows}`);
  console.log("=".repeat(60));
}

// ========================================
// ログイン処理
// ========================================

async function discoverAndLogin(client) {
  try {
    // まず、ログインページを取得
    const loginRes = await client.get(CONFIG.loginPath, {
      followRedirect: false,
    });

    // リダイレクトされた場合はそのURLへ
    let loginHtml = loginRes.body;
    if (loginRes.status >= 300 && loginRes.status < 400 && loginRes.location) {
      const redirectRes = await client.get(loginRes.location);
      loginHtml = redirectRes.body;
    } else if (loginRes.status >= 400) {
      // /login が無い場合は / やよくあるパスを試す
      const alternativePaths = ["/", "/signin", "/auth/login", "/admin/login", "/user/login", "/admin"];
      for (const altPath of alternativePaths) {
        const altRes = await client.get(altPath);
        if (altRes.status < 400) {
          loginHtml = altRes.body;
          break;
        }
      }
    }

    // フォームを検出
    const forms = extractForms(loginHtml);
    const loginForm = findLoginForm(forms);

    if (!loginForm) {
      return {
        success: false,
        error: "ログインフォームが検出できませんでした",
        html: loginHtml,
      };
    }

    console.log(`  => ログインフォーム検出: ${loginForm.action || CONFIG.loginPath}`);
    console.log(`  => フィールド: ${loginForm.fields.map((f) => f.name).join(", ")}`);

    // ログインリクエスト作成
    const formData = buildLoginFormData(loginForm, CONFIG.credentials);
    const loginAction = loginForm.action || CONFIG.loginPath;

    const loginResponse = await client.post(loginAction, formData, {
      contentType: "form",
      followRedirect: false,
    });

    // リダイレクトを追跡してダッシュボードへ
    let dashboardHtml = loginResponse.body;
    let dashboardPath = "/";

    if (loginResponse.status >= 300 && loginResponse.status < 400) {
      const redirectUrl = loginResponse.location || "/";
      dashboardPath = redirectUrl;
      const dashRes = await client.get(redirectUrl);
      dashboardHtml = dashRes.body;
      dashboardPath = new URL(dashRes.url).pathname || redirectUrl;
    } else if (loginResponse.status === 200) {
      // 200 が返ってきた場合、ログイン成功かチェック
      // フォームがまだ表示されていればログイン失敗
      const postForms = extractForms(loginResponse.body);
      const stillLoginForm = findLoginForm(postForms);
      if (stillLoginForm) {
        return {
          success: false,
          error: "認証情報が正しくないようです (ログインフォームが再表示されました)",
          html: loginResponse.body,
        };
      }
      dashboardHtml = loginResponse.body;
    } else if (loginResponse.status >= 400) {
      return {
        success: false,
        error: `ログインリクエストが HTTP ${loginResponse.status} を返しました`,
        html: loginResponse.body,
      };
    }

    // ログイン成功判定: ダッシュボードにログインフォームが無いこと
    return {
      success: true,
      dashboardHtml,
      dashboardPath,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      html: "",
    };
  }
}

/**
 * フォーム一覧からログインフォームを見つける
 */
function findLoginForm(forms) {
  // パスワードフィールドがあるフォームを優先
  for (const form of forms) {
    const hasPassword = form.fields.some((f) => f.type === "password");
    const hasEmail = form.fields.some(
      (f) =>
        f.type === "email" ||
        f.name?.includes("email") ||
        f.name?.includes("mail") ||
        f.name?.includes("user") ||
        f.name?.includes("login") ||
        f.name?.includes("id")
    );
    if (hasPassword && hasEmail) return form;
  }
  // パスワードフィールドだけあるフォーム
  for (const form of forms) {
    if (form.fields.some((f) => f.type === "password")) return form;
  }
  return null;
}

/**
 * ログインフォームデータを構築
 */
function buildLoginFormData(form, credentials) {
  const data = {};

  for (const field of form.fields) {
    if (field.type === "hidden" && field.name) {
      // CSRF トークン等の hidden フィールド
      data[field.name] = field.value;
    } else if (field.type === "password" && field.name) {
      data[field.name] = credentials.password;
    } else if (
      field.type === "email" ||
      field.name?.includes("email") ||
      field.name?.includes("mail") ||
      field.name?.includes("user") ||
      field.name?.includes("login") ||
      field.name?.includes("id")
    ) {
      if (field.name) data[field.name] = credentials.email;
    }
  }

  return data;
}

// ========================================
// ページデータ抽出
// ========================================

function extractPageData(html, pagePath) {
  return {
    path: pagePath,
    title: extractTitle(html),
    tables: extractTables(html),
    cards: extractCardData(html),
    lists: extractLists(html),
    content: extractMainContent(html),
    extractedAt: new Date().toISOString(),
  };
}

/**
 * ページネーションを検出して追加ページを取得
 */
async function fetchPaginatedData(client, html, basePath, pageName, outputDir, snapshot) {
  const paginationLinks = findPaginationLinks(html, basePath);
  if (paginationLinks.length === 0) return;

  console.log(`     => ページネーション検出: ${paginationLinks.length} ページ`);

  for (let i = 0; i < paginationLinks.length && i < 50; i++) {
    try {
      await sleep(CONFIG.requestDelay);
      const res = await client.get(paginationLinks[i]);
      if (res.status >= 400) continue;

      const pageData = extractPageData(res.body, paginationLinks[i]);
      const subPageName = `${pageName}_page${i + 2}`;
      snapshot.pages[subPageName] = pageData;
      savePageData(outputDir, subPageName, pageData, res.body);
    } catch {
      // ページネーションの取得失敗は無視
    }
  }
}

function findPaginationLinks(html, currentPath) {
  const $ = cheerio.load(html);
  const links = [];

  // よくあるページネーションのセレクタ
  const selectors = [
    ".pagination a[href]",
    ".pager a[href]",
    '[class*="paginat"] a[href]',
    'nav[aria-label*="page"] a[href]',
    ".page-link[href]",
    'a[class*="page"][href]',
  ];

  const seen = new Set([currentPath]);
  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const href = $(el).attr("href");
      if (href && !seen.has(href) && !href.startsWith("#") && !href.startsWith("javascript:")) {
        seen.add(href);
        links.push(href);
      }
    });
  }

  return links;
}

// cheerio を findPaginationLinks でも使うためインポート
import * as cheerio from "cheerio";

// ========================================
// ファイル出力
// ========================================

function savePageData(outputDir, pageName, pageData, rawHtml) {
  // JSON データ
  fs.writeFileSync(
    path.join(outputDir, `${pageName}.json`),
    JSON.stringify(pageData, null, 2),
    "utf-8"
  );

  // 生 HTML も保存 (調査・デバッグ用)
  fs.writeFileSync(
    path.join(outputDir, `${pageName}.html`),
    rawHtml,
    "utf-8"
  );
}

// ========================================
// ユーティリティ
// ========================================

function formatTimestamp(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const H = String(date.getHours()).padStart(2, "0");
  const M = String(date.getMinutes()).padStart(2, "0");
  const S = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}_${H}${M}${S}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ========================================
// 実行
// ========================================

main().catch((err) => {
  console.error("致命的エラー:", err);
  process.exit(1);
});
