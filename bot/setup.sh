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

# --- 1. Qanday ishga tushiramiz: Docker yoki to‘g‘ridan Node ---
MODE=""
# Docker buyrug'i bor-yo'qligi yetarli emas: demon ishlab turishi ham kerak.
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  if docker compose version >/dev/null 2>&1; then
    MODE="docker"; DC="docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    MODE="docker"; DC="docker-compose"
  fi
fi
if [ -z "$MODE" ]; then
  command -v node >/dev/null 2>&1 || die "Na Docker, na Node topildi. Bittasini o‘rnating."
  NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
  [ "$NODE_MAJOR" -ge 20 ] || die "Node 20 yoki undan yangi kerak (hozir: $(node -v))."
  MODE="node"
fi
say "Ishga tushirish usuli: $MODE"

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

  if [ "$MODE" = "docker" ]; then DB="/app/data/qorgon.db"; else DB="./data/qorgon.db"; fi
  umask 077
  cat > .env <<EOF
BOT_TOKEN=$BOT_TOKEN
ADMIN_ID=$ADMIN_ID
PUBLIC_URL=${PUBLIC_URL%/}
PORT=8080
DB_PATH=$DB
EOF
  unset BOT_TOKEN
  say ".env yozildi (faqat sizga o‘qiladi)."
fi

# --- 3. Ishga tushirish ---
if [ "$MODE" = "docker" ]; then
  say "Konteyner yig‘ilmoqda — birinchi marta bir necha daqiqa oladi."
  $DC up -d --build
  say "Log (to‘xtatish uchun Ctrl+C — bot ishlayveradi):"
  sleep 3
  $DC logs --tail 30
else
  say "Paketlar o‘rnatilmoqda…"
  npm install --no-audit --no-fund
  say "Yig‘ilmoqda…"
  npm run build

  # Eski nusxa ishlab tursa, to‘xtatamiz.
  if [ -f bot.pid ] && kill -0 "$(cat bot.pid)" 2>/dev/null; then
    kill "$(cat bot.pid)" 2>/dev/null || true
    sleep 1
  fi

  mkdir -p data
  say "Bot fonda ishga tushmoqda…"
  # --env-file .env ni o'qiydi (Node 20.6+). Docker rejimida buni
  # compose'dagi env_file qiladi.
  nohup node --env-file=.env dist/index.js > bot.log 2>&1 &
  BOT_PID=$!
  echo $BOT_PID > bot.pid
  sleep 4
  if ! kill -0 "$BOT_PID" 2>/dev/null; then
    echo
    tail -20 bot.log || true
    die "Bot ishga tushmadi — yuqoridagi xatoga qarang."
  fi
  tail -20 bot.log || true
fi

if [ "$MODE" = "node" ]; then
cat <<'EOF'

─────────────────────────────────────────────
Bot fonda ishlayapti (Dockersiz).

  Log ko‘rish:   tail -f bot.log
  To‘xtatish:    kill $(cat bot.pid)
  Qayta ishga:   ./setup.sh

Diqqat: Mac uyquga ketsa bot ham to‘xtaydi. Buyruqlar yo‘qolmaydi —
Telegram ularni saqlaydi va Mac uyg‘onganda bajariladi.
EOF
else
cat <<'EOF'

─────────────────────────────────────────────
EOF
fi

cat <<'EOF'
Keyingi qadam: Telegram'da @qorgonbyon_bot ga /start yozing.

  Javob kelsa — hammasi joyida.
  Javob kelmasa — ADMIN_ID xato. To'g'ri raqamni topish uchun
  log'dan "from.id=" qatorini qidiring.
─────────────────────────────────────────────
EOF
