#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="$HOME/.claude/commands"

if [ -L "$TARGET" ]; then
  echo "Symlink já existe: $TARGET -> $(readlink "$TARGET")"
  echo "Removendo symlink antigo..."
  rm "$TARGET"
elif [ -d "$TARGET" ]; then
  echo "AVISO: $TARGET é um diretório real (não symlink)."
  echo "Faça backup e remova manualmente antes de continuar."
  exit 1
fi

mkdir -p "$HOME/.claude"
ln -s "$REPO_DIR/claude/commands" "$TARGET"
echo "Symlink criado: $TARGET -> $REPO_DIR/claude/commands"
