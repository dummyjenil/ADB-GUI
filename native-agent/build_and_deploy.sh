#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "==> Building droid-agent for aarch64-unknown-linux-musl (ARM64-v8a)..."
RUSTFLAGS="-C linker=rust-lld" cargo build --target aarch64-unknown-linux-musl --release

DEST_DIR="$DIR/../src-tauri/resources"
mkdir -p "$DEST_DIR"

echo "==> Copying binary to $DEST_DIR/droid-agent..."
cp target/aarch64-unknown-linux-musl/release/droid-agent "$DEST_DIR/droid-agent"
chmod +x "$DEST_DIR/droid-agent"

echo "==> Done! Size:"
ls -lh "$DEST_DIR/droid-agent"
