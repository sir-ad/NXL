#!/bin/sh
set -e

# NXL Installer
# curl -fsSL https://nexus-prime.cfd/nxl/install.sh | sh

NXL_DIR="${NXL_HOME:-$HOME/.nxl}"
NXL_BIN="$NXL_DIR/bin"
REPO="https://github.com/sir-ad/NXL.git"

info() { printf "\033[0;36m%s\033[0m\n" "$1"; }
ok()   { printf "\033[0;32m%s\033[0m\n" "$1"; }
err()  { printf "\033[0;31m%s\033[0m\n" "$1" >&2; exit 1; }

# Check dependencies
command -v git  >/dev/null 2>&1 || err "git is required"
command -v node >/dev/null 2>&1 || err "node >= 22 is required"

# Check for bun or pnpm
if command -v bun >/dev/null 2>&1; then
  RUNNER="bun"
elif command -v pnpm >/dev/null 2>&1; then
  RUNNER="pnpm"
elif command -v npm >/dev/null 2>&1; then
  RUNNER="npm"
else
  err "bun, pnpm, or npm is required"
fi

info "Installing NXL..."

# Clone or update
if [ -d "$NXL_DIR" ]; then
  info "Updating existing installation..."
  cd "$NXL_DIR" && git pull --quiet origin main
else
  info "Cloning NXL..."
  git clone --quiet --depth 1 "$REPO" "$NXL_DIR"
fi

cd "$NXL_DIR"

# Install dependencies
info "Installing dependencies with $RUNNER..."
if [ "$RUNNER" = "pnpm" ]; then
  pnpm install --silent
elif [ "$RUNNER" = "bun" ]; then
  bun install --silent
else
  npm install --silent
fi

# Create bin wrapper
mkdir -p "$NXL_BIN"
cat > "$NXL_BIN/nxl" << 'WRAPPER'
#!/bin/sh
exec bun "$HOME/.nxl/packages/nxl-cli/src/index.ts" "$@" 2>/dev/null || \
exec node --import tsx "$HOME/.nxl/packages/nxl-cli/src/index.ts" "$@"
WRAPPER
chmod +x "$NXL_BIN/nxl"

# Add to PATH
SHELL_NAME=$(basename "$SHELL")
EXPORT_LINE="export PATH=\"\$HOME/.nxl/bin:\$PATH\""

add_to_profile() {
  if ! grep -q '.nxl/bin' "$1" 2>/dev/null; then
    echo "" >> "$1"
    echo "# NXL" >> "$1"
    echo "$EXPORT_LINE" >> "$1"
  fi
}

case "$SHELL_NAME" in
  zsh)  add_to_profile "$HOME/.zshrc" ;;
  bash) add_to_profile "$HOME/.bashrc" ;;
  fish) mkdir -p "$HOME/.config/fish"
        echo "set -gx PATH \$HOME/.nxl/bin \$PATH" >> "$HOME/.config/fish/config.fish" ;;
esac

ok ""
ok "  NXL installed successfully."
ok ""
ok "  Run:  nxl repl"
ok ""
ok "  If 'nxl' isn't found, restart your terminal or run:"
ok "    $EXPORT_LINE"
ok ""
