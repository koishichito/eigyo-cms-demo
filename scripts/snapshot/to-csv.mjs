#!/usr/bin/env node
// ========================================
// スナップショット JSON → CSV 変換ツール
//
// 使い方:
//   node scripts/snapshot/to-csv.mjs ./snapshots/2026-02-06_123456
// ========================================

import fs from "node:fs";
import path from "node:path";

const snapshotDir = process.argv[2];

if (!snapshotDir) {
  console.error("使い方: node scripts/snapshot/to-csv.mjs <snapshot-directory>");
  console.error("例:     node scripts/snapshot/to-csv.mjs ./snapshots/2026-02-06_123456");
  process.exit(1);
}

const allTablesPath = path.join(snapshotDir, "_all_tables.json");
if (!fs.existsSync(allTablesPath)) {
  console.error(`${allTablesPath} が見つかりません。先にスナップショットを実行してください。`);
  process.exit(1);
}

const allTables = JSON.parse(fs.readFileSync(allTablesPath, "utf-8"));
const csvDir = path.join(snapshotDir, "csv");
fs.mkdirSync(csvDir, { recursive: true });

let totalFiles = 0;

for (const [pageName, tables] of Object.entries(allTables)) {
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    if (!table.headers || table.headers.length === 0) continue;

    const fileName = `${pageName}${tables.length > 1 ? `_table${i + 1}` : ""}.csv`;
    const csvContent = tableToCsv(table);
    fs.writeFileSync(path.join(csvDir, fileName), csvContent, "utf-8");
    totalFiles++;
    console.log(`  [✓] ${fileName} (${table.rowCount} 行)`);
  }
}

console.log();
console.log(`CSV 出力完了: ${totalFiles} ファイル → ${csvDir}`);

function tableToCsv(table) {
  const lines = [];

  // ヘッダー
  lines.push(table.headers.map(escapeCsv).join(","));

  // データ行
  for (const row of table.rows) {
    if (Array.isArray(row)) {
      lines.push(row.map(escapeCsv).join(","));
    } else {
      const cells = table.headers.map((h) => escapeCsv(row[h] || ""));
      lines.push(cells.join(","));
    }
  }

  // BOM 付き UTF-8 (Excel で日本語が正しく表示される)
  return "\uFEFF" + lines.join("\n") + "\n";
}

function escapeCsv(value) {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
