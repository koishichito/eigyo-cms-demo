// ========================================
// HTML パーサー - ページからデータを抽出
// ========================================

import * as cheerio from "cheerio";

/**
 * HTML からナビゲーションリンクを抽出
 */
export function extractNavLinks(html, baseUrl) {
  const $ = cheerio.load(html);
  const links = new Set();

  // ナビゲーション・サイドバー・メニュー内のリンクを取得
  const navSelectors = [
    "nav a[href]",
    ".sidebar a[href]",
    ".nav a[href]",
    ".menu a[href]",
    ".sidenav a[href]",
    '[class*="nav"] a[href]',
    '[class*="menu"] a[href]',
    '[class*="sidebar"] a[href]',
    '[id*="nav"] a[href]',
    '[id*="menu"] a[href]',
    '[id*="sidebar"] a[href]',
    'aside a[href]',
    'header a[href]',
    '.navbar a[href]',
  ];

  for (const selector of navSelectors) {
    $(selector).each((_, el) => {
      const href = $(el).attr("href");
      if (href && isInternalLink(href, baseUrl)) {
        links.add(normalizeLink(href, baseUrl));
      }
    });
  }

  // ナビリンクが見つからない場合、ページ内の全内部リンクも取得
  if (links.size === 0) {
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (href && isInternalLink(href, baseUrl)) {
        links.add(normalizeLink(href, baseUrl));
      }
    });
  }

  return Array.from(links);
}

/**
 * HTML からテーブルデータを抽出
 */
export function extractTables(html) {
  const $ = cheerio.load(html);
  const tables = [];

  $("table").each((index, table) => {
    const headers = [];
    const rows = [];

    // ヘッダー取得
    $(table)
      .find("thead th, thead td, tr:first-child th")
      .each((_, th) => {
        headers.push($(th).text().trim());
      });

    // ヘッダーが取れない場合は最初の行を使う
    if (headers.length === 0) {
      $(table)
        .find("tr:first-child td")
        .each((_, td) => {
          headers.push($(td).text().trim());
        });
    }

    // データ行取得
    const rowSelector = headers.length > 0 ? "tbody tr, tr:not(:first-child)" : "tr";
    $(table)
      .find(rowSelector)
      .each((_, tr) => {
        const row = {};
        const cells = [];
        $(tr)
          .find("td, th")
          .each((cellIndex, td) => {
            const text = $(td).text().trim();
            cells.push(text);
            if (headers[cellIndex]) {
              row[headers[cellIndex]] = text;
            }
          });
        if (cells.some((c) => c.length > 0)) {
          rows.push(headers.length > 0 ? row : cells);
        }
      });

    if (rows.length > 0) {
      tables.push({
        index,
        headers,
        rowCount: rows.length,
        rows,
      });
    }
  });

  return tables;
}

/**
 * HTML からフォーム情報を抽出 (ログインフォーム検出用)
 */
export function extractForms(html) {
  const $ = cheerio.load(html);
  const forms = [];

  $("form").each((_, form) => {
    const action = $(form).attr("action") || "";
    const method = ($(form).attr("method") || "GET").toUpperCase();
    const fields = [];

    $(form)
      .find("input, select, textarea")
      .each((_, input) => {
        fields.push({
          name: $(input).attr("name") || "",
          type: $(input).attr("type") || "text",
          value: $(input).attr("value") || "",
          id: $(input).attr("id") || "",
        });
      });

    forms.push({ action, method, fields });
  });

  return forms;
}

/**
 * HTML からカード/KPI/サマリーデータを抽出
 */
export function extractCardData(html) {
  const $ = cheerio.load(html);
  const cards = [];

  // よくあるダッシュボードカードのセレクタ
  const cardSelectors = [
    ".card",
    ".widget",
    ".stat",
    ".kpi",
    '[class*="card"]',
    '[class*="widget"]',
    '[class*="stat"]',
    '[class*="summary"]',
    '[class*="dashboard"]',
    ".panel",
    ".box",
  ];

  const seen = new Set();
  for (const selector of cardSelectors) {
    $(selector).each((_, el) => {
      const text = $(el).text().trim().replace(/\s+/g, " ");
      if (text.length > 0 && text.length < 500 && !seen.has(text)) {
        seen.add(text);
        cards.push({
          selector,
          text,
          html: $(el).html()?.substring(0, 1000) || "",
        });
      }
    });
  }

  return cards;
}

/**
 * HTML からリストデータを抽出
 */
export function extractLists(html) {
  const $ = cheerio.load(html);
  const lists = [];

  $("ul, ol, dl").each((index, list) => {
    const items = [];
    $(list)
      .find("li, dt, dd")
      .each((_, item) => {
        const text = $(item).text().trim();
        if (text.length > 0) items.push(text);
      });
    if (items.length > 0) {
      lists.push({ index, tag: list.tagName, items });
    }
  });

  return lists;
}

/**
 * ページタイトルを取得
 */
export function extractTitle(html) {
  const $ = cheerio.load(html);
  return (
    $("title").text().trim() ||
    $("h1").first().text().trim() ||
    $("h2").first().text().trim() ||
    ""
  );
}

/**
 * ページの主要テキストコンテンツを抽出
 */
export function extractMainContent(html) {
  const $ = cheerio.load(html);
  // main, article, content エリアのテキスト
  const mainSelectors = [
    "main",
    "article",
    '[role="main"]',
    "#content",
    ".content",
    "#main",
    ".main",
  ];

  for (const selector of mainSelectors) {
    const el = $(selector);
    if (el.length > 0) {
      return el.text().trim().replace(/\s+/g, " ").substring(0, 5000);
    }
  }

  // フォールバック: body からナビ/フッターを除く
  $("nav, header, footer, script, style, .sidebar, .menu").remove();
  return $("body").text().trim().replace(/\s+/g, " ").substring(0, 5000);
}

// --- ユーティリティ ---

function isInternalLink(href, baseUrl) {
  if (href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) {
    return false;
  }
  if (href.startsWith("/")) return true;
  if (href.startsWith(baseUrl)) return true;
  if (!href.startsWith("http")) return true;
  return false;
}

function normalizeLink(href, baseUrl) {
  if (href.startsWith("http")) {
    return new URL(href).pathname;
  }
  if (href.startsWith("/")) return href.split("?")[0].split("#")[0];
  return "/" + href.split("?")[0].split("#")[0];
}
