#!/usr/bin/env bash
# ============================================================
#  release.sh — 新しいバージョンをリリースする
#
#  使い方:
#    ./scripts/release.sh 1.0.0          ← v1.0.0 としてリリース
#    ./scripts/release.sh 1.0.1 "修正内容の説明"  ← メモ付き
#
#  何が起きるか:
#    1. コードに問題がないかビルドチェック
#    2. 今の状態に「v1.0.0」というタグ（しおり）をつける
#    3. dist/ フォルダにビルド成果物を生成
#    4. releases/ フォルダにバックアップを保存
#
#  ※ このスクリプトは自動でデプロイ（公開）はしません。
#    ビルド結果を確認してから手動でデプロイしてください。
# ============================================================
set -euo pipefail

VERSION="${1:?エラー: バージョン番号を指定してください（例: ./scripts/release.sh 1.0.0）}"
MESSAGE="${2:-Release v${VERSION}}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RELEASES_DIR="$PROJECT_DIR/releases"

cd "$PROJECT_DIR"

# ── 1. 事前チェック ──────────────────────────
echo ""
echo "=== リリース準備: v${VERSION} ==="
echo ""

# 未コミットの変更がないか確認
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ エラー: コミットされていない変更があります。"
  echo "   先に変更をコミットしてからリリースしてください。"
  echo ""
  git status --short
  exit 1
fi

# 同じバージョンのタグが既に存在しないか確認
if git rev-parse "v${VERSION}" >/dev/null 2>&1; then
  echo "❌ エラー: v${VERSION} は既にリリース済みです。"
  echo "   別のバージョン番号を指定してください。"
  echo ""
  echo "既存のリリース一覧:"
  git tag --list 'v*' --sort=-version:refname
  exit 1
fi

# ── 2. ビルド ────────────────────────────────
echo "📦 ビルド中..."
npm run build

if [ ! -d "$PROJECT_DIR/dist" ]; then
  echo "❌ エラー: ビルドに失敗しました（dist/ が見つかりません）"
  exit 1
fi

echo "✅ ビルド成功"
echo ""

# ── 3. タグ作成 ──────────────────────────────
echo "🏷️  タグ作成: v${VERSION}"
git tag -a "v${VERSION}" -m "${MESSAGE}"

# ── 4. バックアップ保存 ──────────────────────
mkdir -p "$RELEASES_DIR"
BACKUP_NAME="v${VERSION}_$(date +%Y%m%d_%H%M%S)"
cp -r "$PROJECT_DIR/dist" "$RELEASES_DIR/$BACKUP_NAME"

echo "💾 バックアップ保存: releases/${BACKUP_NAME}/"
echo ""

# ── 5. 完了サマリ ────────────────────────────
echo "=== リリース完了 ==="
echo ""
echo "  バージョン:   v${VERSION}"
echo "  タグ:         $(git rev-parse --short v${VERSION})"
echo "  ビルド成果物: dist/"
echo "  バックアップ: releases/${BACKUP_NAME}/"
echo ""
echo "次のステップ:"
echo "  1. dist/ の内容を確認してください"
echo "  2. 問題なければデプロイしてください"
echo "  3. タグをリモートに送る: git push origin v${VERSION}"
echo ""
echo "もし問題が起きたら:"
echo "  ./scripts/rollback.sh    ← 前のバージョンに戻せます"
echo ""
