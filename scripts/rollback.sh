#!/usr/bin/env bash
# ============================================================
#  rollback.sh — 前のバージョンに戻す（ロールバック）
#
#  使い方:
#    ./scripts/rollback.sh              ← 1つ前のバージョンに戻す
#    ./scripts/rollback.sh v1.0.0       ← 指定バージョンに戻す
#    ./scripts/rollback.sh --list       ← 戻せるバージョン一覧を見る
#    ./scripts/rollback.sh --current    ← 今のバージョンを確認
#
#  何が起きるか:
#    1. 指定バージョンのコードに切り替え
#    2. そのバージョンでビルドし直し
#    3. dist/ が入れ替わる
#    4. releases/ にバックアップがあればそれを使用（高速）
#
#  ※ ロールバック後、デプロイは手動で行ってください。
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RELEASES_DIR="$PROJECT_DIR/releases"

cd "$PROJECT_DIR"

# ── ヘルパー関数 ─────────────────────────────
list_versions() {
  echo ""
  echo "=== リリース済みバージョン一覧 ==="
  echo ""
  local tags
  tags=$(git tag --list 'v*' --sort=-version:refname 2>/dev/null)
  if [ -z "$tags" ]; then
    echo "  （まだリリースがありません）"
  else
    local current_tag
    current_tag=$(git describe --tags --exact-match 2>/dev/null || echo "")
    while IFS= read -r tag; do
      local date commit
      date=$(git log -1 --format='%ci' "$tag" 2>/dev/null | cut -d' ' -f1)
      commit=$(git rev-parse --short "$tag" 2>/dev/null)
      if [ "$tag" = "$current_tag" ]; then
        echo "  → ${tag}  (${date})  ${commit}  ← 現在"
      else
        echo "    ${tag}  (${date})  ${commit}"
      fi
    done <<< "$tags"
  fi
  echo ""

  if [ -d "$RELEASES_DIR" ]; then
    local backups
    backups=$(ls -1 "$RELEASES_DIR" 2>/dev/null)
    if [ -n "$backups" ]; then
      echo "=== ビルドバックアップ（releases/） ==="
      echo ""
      while IFS= read -r dir; do
        echo "    ${dir}/"
      done <<< "$backups"
      echo ""
    fi
  fi
}

show_current() {
  echo ""
  local tag commit branch
  tag=$(git describe --tags --exact-match 2>/dev/null || echo "タグなし")
  commit=$(git rev-parse --short HEAD)
  branch=$(git branch --show-current)
  echo "  ブランチ:     ${branch}"
  echo "  タグ:         ${tag}"
  echo "  コミット:     ${commit}"
  echo "  最終コミット: $(git log -1 --format='%s' HEAD)"
  echo ""
}

# ── 引数処理 ─────────────────────────────────
TARGET="${1:-}"

if [ "$TARGET" = "--list" ] || [ "$TARGET" = "-l" ]; then
  list_versions
  exit 0
fi

if [ "$TARGET" = "--current" ] || [ "$TARGET" = "-c" ]; then
  echo "=== 現在のバージョン ==="
  show_current
  exit 0
fi

# ── 未コミット変更チェック ────────────────────
if [ -n "$(git status --porcelain)" ]; then
  echo ""
  echo "❌ エラー: コミットされていない変更があります。"
  echo "   先に変更をコミットするか、破棄してからロールバックしてください。"
  echo ""
  git status --short
  exit 1
fi

# ── ターゲットバージョン決定 ──────────────────
if [ -z "$TARGET" ]; then
  # 引数なし → 1つ前のタグを探す
  CURRENT_TAG=$(git describe --tags --exact-match 2>/dev/null || echo "")
  ALL_TAGS=$(git tag --list 'v*' --sort=-version:refname)

  if [ -z "$ALL_TAGS" ]; then
    echo "❌ エラー: リリースタグが見つかりません。"
    echo "   先に ./scripts/release.sh でリリースしてください。"
    exit 1
  fi

  if [ -z "$CURRENT_TAG" ]; then
    # 現在タグ上にいない → 最新タグに戻す
    TARGET=$(echo "$ALL_TAGS" | head -1)
    echo "現在はタグ上にいません。最新リリース ${TARGET} に戻します。"
  else
    # 1つ前のタグを探す
    PREV_TAG=$(echo "$ALL_TAGS" | grep -A1 "^${CURRENT_TAG}$" | tail -1)
    if [ "$PREV_TAG" = "$CURRENT_TAG" ] || [ -z "$PREV_TAG" ]; then
      echo "❌ エラー: ${CURRENT_TAG} より前のリリースがありません。"
      list_versions
      exit 1
    fi
    TARGET="$PREV_TAG"
  fi
fi

# ── タグ存在確認 ──────────────────────────────
if ! git rev-parse "$TARGET" >/dev/null 2>&1; then
  echo "❌ エラー: ${TARGET} が見つかりません。"
  list_versions
  exit 1
fi

# ── ロールバック確認 ──────────────────────────
echo ""
echo "=== ロールバック ==="
echo ""
echo "  現在: $(git describe --tags 2>/dev/null || git rev-parse --short HEAD)"
echo "  戻す先: ${TARGET}"
echo ""
read -p "本当にロールバックしますか？ [y/N] " confirm
if [[ ! "$confirm" =~ ^[yY]$ ]]; then
  echo "キャンセルしました。"
  exit 0
fi

# ── バックアップから復元を試みる ──────────────
BACKUP_MATCH=$(ls -1d "$RELEASES_DIR"/${TARGET#v}_* 2>/dev/null | head -1 || true)

if [ -n "$BACKUP_MATCH" ] && [ -d "$BACKUP_MATCH" ]; then
  echo ""
  echo "💾 バックアップから復元: $(basename "$BACKUP_MATCH")/"
  rm -rf "$PROJECT_DIR/dist"
  cp -r "$BACKUP_MATCH" "$PROJECT_DIR/dist"
  echo "✅ dist/ を復元しました（ビルド不要・高速）"
else
  # バックアップなし → チェックアウトしてビルド
  echo ""
  echo "📦 ${TARGET} をチェックアウトしてビルドします..."

  # 現在のブランチを記録
  CURRENT_BRANCH=$(git branch --show-current)

  git checkout "$TARGET" --detach
  npm run build

  if [ ! -d "$PROJECT_DIR/dist" ]; then
    echo "❌ エラー: ビルドに失敗しました"
    git checkout "$CURRENT_BRANCH"
    exit 1
  fi

  echo "✅ ビルド成功"

  # 元のブランチに戻る（dist/ はロールバック版が残る）
  git checkout "$CURRENT_BRANCH"
fi

echo ""
echo "=== ロールバック完了 ==="
echo ""
echo "  dist/ の中身は ${TARGET} のビルド成果物です。"
echo "  この dist/ をデプロイしてください。"
echo ""
echo "  確認コマンド:  npm run preview"
echo ""
