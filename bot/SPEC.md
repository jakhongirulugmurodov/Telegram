# Qo‘rg‘on: ilova ↔ bot protokoli

Bu fayl ikki tomon orasidagi **shartnoma**. Ilova tomonini o‘zgartirsangiz
(`QorgonControl.java`), shu faylni ham yangilang — aks holda bot va ilova
bir-birini tushunmay qoladi.

## Transport

Alohida server, Firebase yoki webhook yo‘q. Oila a’zosining akkaunti bilan
admin boti (`@qorgonbyon_bot`) orasidagi **oddiy shaxsiy chat** transport
bo‘lib xizmat qiladi.

- Ilova o‘sha chatga xabar yozadi → bot `message` hodisasi sifatida oladi.
- Bot o‘sha chatga xabar yozadi → ilova `onNewMessages()` da ushlaydi.

Chat Qo‘rg‘on ichida **ko‘rinmaydi**: oq ro‘yxatdan o‘tmaydi, shuning uchun
chat ro‘yxatida ham, bildirishnomalarda ham chiqmaydi. Lekin xabarlari
qayta ishlanadi — filtr faqat ko‘rsatishga ta’sir qiladi.

## Format

Bitta qator, maydonlar `|` bilan ajratiladi. JSON ishlatilmaydi: Telegram
xabarlari ba’zan tahrirlanadi, formatlanadi yoki bo‘linadi, oddiy matn esa
har doim butun o‘tadi.

### Ilova → bot

| Xabar | Ma’nosi |
|---|---|
| `/start qorgon` | Ilova birinchi ishga tushdi. Telegram qoidasi: bot faqat o‘ziga `/start` bosgan odamga yoza oladi, shuning uchun buni ilova o‘zi yuboradi. `qorgon` qo‘shimchasi kerak: admin o‘z qo‘li bilan yozgan oddiy `/start` dan ajralishi uchun |
| `jurnal\|<dialogId>\|<kim>` | Ruxsatsiz odam yozdi. `<kim>` = `@username Ism`. **Xabar matni hech qachon yuborilmaydi** |
| `ok\|list\|<e1>\|<e2>\|…` | Joriy oq ro‘yxat |
| `ok\|+\|<qiymat>` | Qo‘shildi |
| `ok\|-\|<qiymat>` | Olib tashlandi |
| `ok\|clear` | Ro‘yxat tozalandi |
| `xato\|<sabab>` | Buyruq bajarilmadi |

### Bot → ilova

| Xabar | Ma’nosi |
|---|---|
| `+@username` | Oq ro‘yxatga qo‘shish |
| `+-1001234567890` | Raqamli dialog ID bo‘yicha qo‘shish |
| `+Oila guruhi` | Aniq sarlavha bo‘yicha qo‘shish |
| `-@username` | Olib tashlash |
| `list` | Ro‘yxatni so‘rash |
| `clear` | Ro‘yxatni tozalash |

Ilova `#qorgon` prefiksini ham qabul qiladi (`#qorgon +@x`), lekin bot uni
ishlatmaydi.

## Muhim cheklovlar

**Javob kafolatlanmagan.** Telefon o‘chiq bo‘lsa, buyruq Telegram’da turadi
va telefon yoqilganda bajariladi. Bot javobni kutib qotib qolmaydi: yuboradi,
javob kelganda bazani yangilaydi.

**Ro‘yxat ilovada turadi, botda emas.** Bot faqat oxirgi ma’lum holatni
keshlaydi. Haqiqat manbai — telefon. Shuning uchun mini app’da «yangilash»
tugmasi bor: u `list` yuboradi va javobni kutadi.

**Jurnalda matn yo‘q.** Faqat ID va ism. Bu ataylab: boshqaruv xabarlari
oila a’zosining o‘z akkauntida yotadi, u yerga xabar matnini yozish
maxfiylikni buzadi.
