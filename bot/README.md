# Qo‘rg‘on boti va mini app

Oila telefonlaridagi oq ro‘yxatni masofadan boshqarish. Telefonga qayta
APK o‘rnatish kerak emas: chat qo‘shilsa, bir necha soniyada paydo bo‘ladi.

## Qanday ishlaydi

```
Mini app  →  bot  →  Telegram  →  Qo‘rg‘on ilovasi
   ↑                                      ↓
   └──────── jurnal va holat ─────────────┘
```

Alohida backend yoki Firebase yo‘q. Ilova Telegram mijozi bo‘lgani uchun,
bot bilan shaxsiy chat transport bo‘lib xizmat qiladi. Protokol: `SPEC.md`.

Bot chati Qo‘rg‘on ichida **ko‘rinmaydi** — oila a’zosi uni ochib ko‘ra
olmaydi.

## Ishga tushirish

```bash
cp .env.example .env     # BOT_TOKEN va ADMIN_ID ni to'ldiring
docker compose up -d --build
docker compose logs -f
```

`ADMIN_ID` ni bilmasangiz, eng tezi — Telegram’da `@userinfobot` ga yozing,
u sizning id’ingizni qaytaradi. Boshqa yo‘l: botni ishga tushiring, unga
yozing, `docker compose logs` da `from.id=...` ko‘rinadi.

### Mini app uchun https

Telegram mini app’lar faqat `https` manzilni qabul qiladi. Konteyner
`127.0.0.1:8080` da turadi, uni reverse proxy orqali chiqaring. Caddy misoli:

```
qorgon.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

Keyin `.env` da `PUBLIC_URL` ni o‘sha manzilga qo‘ying va konteynerni
qayta ishga tushiring. BotFather’da ham shu manzilni qo‘yish shart emas —
panel tugmasi bot ichida `/start` bosganda chiqadi.

## Ishlatish

**Telefon ulash.** Hech narsa qilinmaydi. Qo‘rg‘on o‘rnatilgach, ilova
botga o‘zi `/start` yuboradi va panelda paydo bo‘ladi.

**Chat qo‘shish.** Panelda telefon ostidagi maydonga `@username` yozib
«Qo‘shish». Raqamli ID ham, chatning aniq sarlavhasi ham ishlaydi.

**Begona yozganda.** Botdan xabar keladi: kim va qachon. Ostida «Ruxsat
berish» tugmasi. Xabar matni hech qachon yuborilmaydi.

**Bot buyruqlari** (panel ochilmasa):

| Buyruq | Nima qiladi |
|---|---|
| `/start` | Panel tugmasi va yordam |
| `/qurilmalar` | Ulangan telefonlar |
| `/royxat` | Har bir telefondagi oq ro‘yxat |
| `/yangila` | Holatni telefonlardan qayta so‘rash |

## Tuzilishi

| Fayl | Nima uchun |
|---|---|
| `SPEC.md` | **Ilova bilan protokol.** O‘zgartirsangiz `QorgonControl.java` ni ham o‘zgartiring |
| `src/protocol.ts` | Shu protokolning kod ko‘rinishi |
| `src/bot.ts` | Bot mantiqi: ilovadan kelgan xabarlar, admin tugmalari |
| `src/api.ts` | Mini app API va kirish nazorati |
| `src/db.ts` | SQLite jadvallari |
| `web/index.html` | Mini app — bitta fayl, build kerak emas |

## Xavfsizlik

- `BOT_TOKEN` faqat `.env` da. Git’ga tushmaydi.
- Mini app’ning har bir so‘rovi Telegram imzosi bilan tekshiriladi va
  faqat `ADMIN_ID` o‘tadi. Havolani bilgan odam hech narsa qila olmaydi.
- Jurnalda xabar matni yo‘q — faqat kim va qachon.

## Cheklovlar

- **Javob kafolatlanmagan.** Telefon o‘chiq bo‘lsa, buyruq Telegram’da
  turadi va telefon yoqilganda bajariladi.
- **Haqiqat manbai — telefon.** Bot faqat oxirgi ma’lum holatni keshlaydi,
  shuning uchun «Telefondan yangilash» tugmasi bor.
- **Bitta admin.** Ko‘p adminli ish ko‘zda tutilmagan.

## Keyingi qadamlar

- Oila a’zosining telefoniga nom qo‘yish (`/api/label` tayyor, panelda
  tugmasi yo‘q)
- «Ruxsat so‘rash» — a’zo o‘zi so‘rov yuborishi
- Ro‘yxatni bir telefondan ikkinchisiga nusxalash
