#!/usr/bin/env bash
# Qo‘rg‘on botini bir buyruq bilan ishga tushirish.
#
#   cd qorgon/bot && ./setup.sh
#
# Token terminalda ko‘rinmaydi va faqat .env ga yoziladi.

set -euo pipefail
cd "$(dirname "$0")"

say()  { printf '\n\033[1;36m%s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m%s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

# --- 1. Docker bormi ---
command -v docker >/dev/null 2>&1 || die "Docker topilmadi. Avval Docker o‘rnating."
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  die "docker compose topilmadi."
fi

# --- 2. Sozlamalar ---
if [ -f .env ]; then
  say ".env allaqachon bor — o‘zgartirilmaydi."
  warn "Qiymatlarni almashtirmoqchi bo‘lsangiz: rm .env && ./setup.sh"
else
  say "Ikkita qiymat kerak."
  echo "  1) BotFather bergan token (@BotFather -> /mytoken)"
  echo "  2) Sizning Telegram id'ingiz (@userinfobot ga /start yozsangiz beradi)"
  echo

  printf 'BOT_TOKEN (ko‘rinmaydi): '
  read -r -s BOT_TOKEN
  echo
  [ -n "$BOT_TOKEN" ] || die "Token bo‘sh."
  case "$BOT_TOKEN" in
    *:*) ;;
    *) die "Token noto‘g‘ri ko‘rinadi — u '123456:ABC...' shaklida bo‘ladi." ;;
  esac

  printf 'ADMIN_ID (raqam): '
  read -r ADMIN_ID
  case "$ADMIN_ID" in
    ''|*[!0-9]*) die "ADMIN_ID faqat raqamlardan iborat bo‘lishi kerak." ;;
  esac

  printf 'PUBLIC_URL (https manzil, hozircha bo‘sh qoldirsangiz ham bo‘ladi): '
  read -r PUBLIC_URL

  umask 077
  cat > .env <<EOF
BOT_TOKEN=$BOT_TOKEN
ADMIN_ID=$ADMIN_ID
PUBLIC_URL=${PUBLIC_URL%/}
PORT=8080
DB_PATH=/app/data/qorgon.db
EOF
  unset BOT_TOKEN
  say ".env yozildi (faqat sizga o‘qiladi)."
fi

# --- 3. Ishga tushirish ---
say "Konteyner yig‘ilmoqda — birinchi marta bir necha daqiqa oladi."
$DC up -d --build

say "Log (to‘xtatish uchun Ctrl+C — bot ishlayveradi):"
sleep 3
$DC logs --tail 30

cat <<'EOF'

─────────────────────────────────────────────
Keyingi qadam: Telegram'da @qorgonbyon_bot ga /start yozing.

  Javob kelsa — hammasi joyida.
  Javob kelmasa — ADMIN_ID xato. To'g'ri raqamni topish uchun:
      docker compose logs | grep from.id

Mini app uchun https kerak. Reverse proxy sozlagach:
      nano .env        # PUBLIC_URL=https://...
      docker compose up -d
─────────────────────────────────────────────
EOF
