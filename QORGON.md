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

---

## Kod razvedkasi (v13.1.1 kodida tasdiqlangan)

Filtr qo‘yiladigan joylar. Qator raqamlari shu versiyaga tegishli — upstream
merge’idan keyin qayta tekshiriladi.

| Joy | Fayl · qator |
|---|---|
| Chat ro‘yxati (yagona tor joy) | `MessagesController.sortDialogs()` · 22373; `allDialogs` qayta yig‘iladi · 2386 |
| Kiruvchi xabar | `MessagesController.processUpdates()` · 17871 |
| Arxivlash (tayyor metod) | `MessagesController.addDialogToFolder()` · 12372 → `TL_folders_editPeerFolders` |
| Ovozsiz qilish (tayyor metod) | `NotificationsController.muteDialog()` · 6325 |
| Bildirishnoma | `NotificationsController.processNewMessages()` · 1076 |
| Kiruvchi qo‘ng‘iroq | `MessagesController` · 20488, `call instanceof TL_phone.phoneCallRequested` |
| Qidiruv | `DialogsSearchAdapter.searchDialogs()` · 1098 |
| t.me havolalari | `LaunchActivity.runLinkRequest()` · 4037 |
| Kontaktlar | `ui/ContactsActivity.java` |
| API kaliti | `BuildVars.java` · 29 |

### Diqqat: APP_ID = 4

`BuildVars.java`da `APP_ID = 4`, `APP_HASH` esa Telegram’ning **rasmiy Android
ilovasiga tegishli** qiymat. Upstream buni reproducible build uchun qoldirgan.

0a bosqichida (faqat o‘z telefonida sinash) shu bilan ishlayveradi, lekin
**oila a’zolariga tarqatishdan oldin albatta o‘z `api_id` bilan almashtiriladi.**
Bu 0b bosqichi va u ixtiyoriy emas.

### Kutilayotgan ish shakli

Bitta `Allowlist` klassi, har bir yuqoridagi joyda bitta `isAllowed(peerId)`
chaqiruvi. Upstream bu fayllarni tez-tez o‘zgartiradi, shuning uchun
o‘zgarishlar qancha kichik bo‘lsa, 5-bosqichdagi merge shuncha oson.

---

## 1-bosqich: kodda yozilgan oq ro‘yxat

Yangi fayl: `TMessagesProj/src/main/java/org/telegram/messenger/Allowlist.java`

- `ENABLED` — filtrni butunlay o‘chirish bayrog‘i.
- `ALLOWED` — ruxsat berilgan chatlar. Uch shaklni qabul qiladi:
  `@username`, raqamli dialog ID, yoki chatning aniq sarlavhasi.
- Doim ochiq qoladiganlar: **Saved Messages** va **777000** (Telegram
  xizmat akkaunti — kirish kodlari va xavfsizlik ogohlantirishlari shu
  yerdan keladi, uni yashirish akkauntdan ayrilish xavfini tug‘diradi).
- `ALLOWED` bo‘sh bo‘lsa filtr ishlamaydi — bo‘sh ro‘yxat bilan hamma
  chatni yashirish ilovani ishlatib bo‘lmas holga keltiradi.

Ulangan joylar:

| Nima | Qayerda |
|---|---|
| Chat ro‘yxati | `MessagesController.sortDialogs()` boshida `Allowlist.prune()` |
| Bildirishnoma | `NotificationsController.processNewMessages()` |
| Kiruvchi qo‘ng‘iroq | `MessagesController`, `phoneCallRequested` shoxi |

Tarmoqqa qo‘shimcha so‘rov ketmaydi: username va sarlavha ilovaning o‘z
keshidan o‘qiladi, chunki filtr allaqachon yuklangan dialoglar ustida ishlaydi.

### Ma’lum cheklovlar

- Yashirilgan chatning ID va username’i jurnalga yoziladi, lekin
  `BuildVars.LOGS_ENABLED` standalone build’da `false`. Ya’ni ID’larni
  jurnaldan topish faqat debug build’da ishlaydi. Haqiqiy yechim —
  2-bosqichdagi admin jurnali.
- `prune()` dialogni xotiradagi ro‘yxatdan olib tashlaydi. 2-bosqichda
  ro‘yxat real vaqtda o‘zgarganda, chatni qaytarish uchun dialoglarni
  qayta yuklash kerak bo‘ladi.

### Birinchi telefon sinovidan keyin yopilgan teshiklar

Sinov ko‘rsatdiki, chat ro‘yxatini filtrlash yetarli emas — bir nechta joy
dialoglar ro‘yxatidan mustaqil chiziladi:

| Teshik | Nima ko‘rinardi | Yopilgan joy |
|---|---|---|
| Stories qatori | Ruxsatsiz odamlarning ismi, rasmi va storysi | `StoriesController.fixDeletedAndNonContactsStories()` |
| «Your contacts on Telegram» | Butun kontaktlar ro‘yxati, bosilsa chat ochilardi | `DialogsAdapter` — filtr yoqilganda `onlineContacts = null` |
| Papka tablari | `All 18`, `Manbaalar 6` — yashirilgan chatlar soni | `DialogsActivity.updateFilterTabs()` — tablar chizilmaydi |
| Ilova belgisi va umumiy hisob | 18 ta o‘qilmagan | `MessagesStorage.getMainUnreadCount()`, `NotificationsController.getTotalAllUnreadCount()` → 0 |

Papkalar ichidagi ro‘yxat sinovda bo‘sh chiqdi — demak `sortDialogs()`
filtri papkalarni ham qamrab olgan, alohida tuzatish kerak bo‘lmadi.

Narxi: ruxsat berilgan chatlarning o‘qilmagan belgilari ham ko‘rinmaydi.
2-bosqichda oq ro‘yxat dinamik bo‘lgach, faqat ruxsatlilar bo‘yicha
to‘g‘ri hisob qo‘shiladi.

---

## 2-bosqich: bot boshqaruvi

Oq ro‘yxat APK ichida qotib qolmaydi — `@qorgonbyon_bot` orqali masofadan
o‘zgaradi. Chat qo‘shilsa, telefonda bir necha soniyada paydo bo‘ladi.

**Firebase ishlatilmadi.** Ilovaning o‘zi Telegram mijozi, shuning uchun
bot bilan shaxsiy chat tayyor transport. Yangi tizim qo‘shilmagani uchun
yangi teshik joyi ham ochilmadi, `google-services.json` ga tegilmadi.

| Qism | Qayerda |
|---|---|
| Ilova tomoni | `QorgonControl.java` |
| Protokol | `bot/SPEC.md` — **ikkala tomon uchun shartnoma** |
| Bot va mini app | `bot/` — grammY + SQLite, Docker |

Bot `bot/**` o‘zgarishida APK qayta yig‘ilmaydi (`paths-ignore`).

### Bilib qo‘yish kerak

- Javob kafolatlanmagan: telefon o‘chiq bo‘lsa, buyruq Telegram’da turadi.
- Haqiqat manbai — telefon. Bot faqat keshlaydi, shuning uchun panelda
  «Telefondan yangilash» tugmasi bor.
- Jurnalda xabar matni yo‘q — faqat kim va qachon.
