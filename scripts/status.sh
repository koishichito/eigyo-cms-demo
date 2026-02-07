#!/usr/bin/env bash
# ============================================================
#  status.sh — 今の状態を一目で確認する
#
#  使い方:
#    ./scripts/status.sh
#
#  表示内容:
#    - 現在のバージョン・ブランチ
#    - 未コミットの変更有無
#    - リリース履歴
#    - バックアップ一覧
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RELEASES_DIR="$PROJECT_DIR/releases"

cd "$PROJECT_DIR"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     J-Navi プロジェクト状態          ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── 現在のバージョン ─────────────────────────
BRANCH=$(git branch --show-current 2>/dev/null || echo "不明")
TAG=$(git describe --tags --exact-match 2>/dev/null || echo "タグなし")
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "不明")
LAST_MSG=$(git log -1 --format='%s' HEAD 2>/dev/null || echo "")
LAST_DATE=$(git log -1 --format='%ci' HEAD 2>/dev/null | cut -d' ' -f1,2 || echo "")

echo "📍 現在の状態"
echo "   ブランチ:       ${BRANCH}"
echo "   タグ:           ${TAG}"
echo "   コミット:       ${COMMIT}"
echo "   最終変更:       ${LAST_MSG}"
echo "   最終変更日時:   ${LAST_DATE}"
echo ""

# ── 未コミット変更 ───────────────────────────
CHANGES=$(git status --porcelain 2>/dev/null)
if [ -n "$CHANGES" ]; then
  COUNT=$(echo "$CHANGES" | wc -l | tr -d ' ')
  echo "⚠️  未コミットの変更: ${COUNT} ファイル"
  echo "$CHANGES" | head -10 | sed 's/^/   /'
  if [ "$COUNT" -gt 10 ]; then
    echo "   ... 他 $((COUNT - 10)) ファイル"
  fi
else
  echo "✅ 未コミットの変更なし"
fi
echo ""

# ── リリース履歴 ─────────────────────────────
echo "📋 リリース履歴"
TAGS=$(git tag --list 'v*' --sort=-version:refname 2>/dev/null)
if [ -z "$TAGS" ]; then
  echo "   （まだリリースがありません）"
else
  while IFS= read -r t; do
    local_date=$(git log -1 --format='%ci' "$t" 2>/dev/null | cut -d' ' -f1)
    local_commit=$(git rev-parse --short "$t" 2>/dev/null)
    local_msg=$(git tag -l --format='%(contents:subject)' "$t" 2>/dev/null)
    if [ "$t" = "$TAG" ]; then
      echo "   → ${t}  ${local_date}  ${local_commit}  ← 現在"
    else
      echo "     ${t}  ${local_date}  ${local_commit}"
    fi
    if [ -n "$local_msg" ]; then
      echo "       ${local_msg}"
    fi
  done <<< "$TAGS"
fi
echo ""

# ── ビルドバックアップ ───────────────────────
echo "💾 ビルドバックアップ"
if [ -d "$RELEASES_DIR" ]; then
  BACKUPS=$(ls -1 "$RELEASES_DIR" 2>/dev/null)
  if [ -n "$BACKUPS" ]; then
    while IFS= read -r dir; do
      SIZE=$(du -sh "$RELEASES_DIR/$dir" 2>/dev/null | cut -f1)
      echo "   ${dir}/  (${SIZE})"
    done <<< "$BACKUPS"
  else
    echo "   （バックアップなし）"
  fi
else
  echo "   （releases/ フォルダなし — 初回リリース後に作成されます）"
fi
echo ""

# ── dist/ の状態 ─────────────────────────────
echo "🌐 ビルド成果物 (dist/)"
if [ -d "$PROJECT_DIR/dist" ]; then
  SIZE=$(du -sh "$PROJECT_DIR/dist" 2>/dev/null | cut -f1)
  FILES=$(find "$PROJECT_DIR/dist" -type f 2>/dev/null | wc -l | tr -d ' ')
  echo "   存在します (${SIZE}, ${FILES} ファイル)"
else
  echo "   なし（npm run build で生成してください）"
fi
echo ""
