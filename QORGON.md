# Qo‘rg‘on

Oilaviy Telegram mijozi. Telegram-Android (DrKLO/Telegram) fork‘i.
Faqat admin ruxsat bergan chat, guruh va kanallar ko‘rinadi.

Bu fayl — loyihaning yagona haqiqat manbai. Chizma: artifact havolasida.

---

## Qabul qilingan qarorlar

| Mavzu | Qaror |
|---|---|
| Platforma | Android, APK sifatida. Web va iOS yo‘q |
| Kim uchun | Butun oila. Bolalarda majburiy, kattalarda ixtiyoriy |
| Begona yozsa | Bloklanmaydi. Yashiriladi + arxivlanadi + ovozsiz qilinadi |
| Admin | Yagona |
| Oq ro‘yxat | 1-bosqichda kodda, 2-bosqichdan Firebase Firestore‘da |
| Repo | **Public.** GPL-2.0 talabi + Actions bepul bo‘lishi uchun |
| Kattalar PIN | **Yo‘q.** Sozlamalar va chiqish ochiq qoladi (sabab pastda) |
| Bolalar PIN | Ha, lekin asosiy himoya Family Link |
| ABI | Faqat `arm64-v8a` (`QORGON_ABIS` orqali o‘zgartiriladi) |

### Nega kattalarda PIN yo‘q
Family Link kattalarni boshqarmaydi. Katta odam APK‘ni o‘chirib, rasmiy
Telegram‘ni bir daqiqada qaytara oladi. PIN hech narsani to‘xtatmaydi —
faqat ishonchsizlik signalini beradi. Kattalarda Qo‘rg‘on kelishuvga tayanadi,
texnikaga emas.

---

## Upstream build faktlari (DrKLO/Telegram, v13.1.1 holatiga)

- JDK **17**, Gradle **8.13** (wrapper), AGP **8.13.2**
- Android SDK **36**, build-tools **36.0.0**
- NDK **27.2.12479018**, CMake **3.22.1**
- Submodullar og‘ir: ffmpeg, boringssl, dav1d, libvpx, openh264, libyuv, td, tlottie
- Repo ichida **dummy** `release.keystore`, `google-services.json` va to‘ldirilgan
  `BuildVars.java` bor → fork hech narsa qo‘shmasdan ham yig‘iladi
- Bizga kerakli modul: **`TMessagesProj_AppStandalone`**
  (Play Market‘siz, to‘g‘ridan o‘rnatiladigan variant)
- Buyruq: `./gradlew :TMessagesProj_AppStandalone:assembleAfatStandalone`
- Natija: `TMessagesProj_AppStandalone/build/outputs/apk/afat/standalone/app.apk`
- `applicationId` = `org.telegram.messenger.web` — rasmiy Telegram bilan yonma-yon turadi

---

## Bosqichlar

| # | Nima | Holat |
|---|---|---|
| **0a** | Fork‘ni o‘zgartirmasdan Actions‘da yig‘ish, telefonga o‘rnatish | ⏳ |
| **0b** | `my.telegram.org`‘dan o‘z `api_id`, u bilan haqiqiy akkauntga kirib ko‘rish | ⏳ |
| 1 | Kodda yozilgan oq ro‘yxat: chat, bildirishnoma, qo‘ng‘iroq filtri | |
| 2 | Firebase + admin panel (`docs/`) | |
| 3 | Qidiruv, t.me havolalari, kontaktlar, 2-akkaunt, bolalar PIN‘i | |
| 4 | Family Link sozlamalari + oila uchun qo‘llanma | |
| 5 | `git merge upstream/master` bilan yangilanishlarni qo‘shib borish | |

**0a va 0b — «o‘ladi yoki yashaydi» tekshiruvi.** Ikkalasi o‘tmaguncha filtr
kodi yozilmaydi. 0b alohida turadi, chunki yangi olingan `api_id` bilan
akkauntga kirishda Telegram cheklov qo‘yishi mumkin — buni bir hafta kod
yozgandan keyin emas, hozir bilish kerak.

---

## Ish tartibi

- Barcha o‘zgarishlarimiz `qorgon` branch‘ida. `master` — toza upstream nusxasi.
- Filtr kodi imkon qadar bitta joyda: `Allowlist` klassi + har bir kirish
  nuqtasida bitta chaqiruv. Bu 5-bosqichdagi merge konfliktlarini kamaytiradi.
- `api_id`, `api_hash` va haqiqiy imzo kaliti kodga emas, **GitHub Secrets**‘ga.

## Litsenziya

Upstream GPL-2.0. Fork ham shunday: public repo, manba ochiq.
Ilova nomida va logotipida «Telegram» ishlatilmaydi.
