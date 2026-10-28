package org.telegram.messenger;

import org.telegram.tgnet.TLRPC;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Locale;

/**
 * Qo'rg'on: oq ro'yxat.
 *
 * 1-bosqich: ro'yxat shu faylda qattiq yozilgan. 2-bosqichda u Firebase'dan
 * o'qiladi va bu klassning tashqi ko'rinishi o'zgarmaydi — faqat ALLOWED
 * manbasi almashadi.
 *
 * Ro'yxatda yo'q chat ilovada umuman ko'rinmaydi. Begona odam bloklanmaydi,
 * uning xabari serverda turaveradi, faqat ekranga chiqmaydi.
 */
public class Allowlist {

    /**
     * Filtrni butunlay o'chirish uchun false qiling.
     * Xatoni izlayotganda qulay: APK'ni qayta yig'masdan turib, kodning
     * qolgan qismi upstream bilan bir xil ishlashini tekshirib bo'ladi.
     */
    public static final boolean ENABLED = true;

    /**
     * Ruxsat berilgan chatlar. Har bir yozuv uch shakldan biri:
     *
     *   "@username"        — eng ishonchli, nom o'zgarsa ham buzilmaydi
     *   "-1001234567890"   — raqamli dialog ID, eng aniq
     *   "Oila guruhi"      — chatning aniq sarlavhasi (faqat 1-bosqich uchun;
     *                        sarlavha o'zgarsa moslik yo'qoladi)
     *
     * Bu yerga qo'shish uchun APK qayta yig'iladi. 2-bosqichdan keyin
     * ro'yxat admin panelidan real vaqtda o'zgaradi.
     */
    public static final String[] ALLOWED = {
            "@jahongir_on_blog",
    };

    /**
     * Telegram'ning xizmat akkaunti: kirish kodlari va xavfsizlik
     * ogohlantirishlari shu yerdan keladi. Hech qachon yashirilmaydi —
     * aks holda akkauntga kira olmay qolish xavfi bor.
     */
    private static final long TELEGRAM_SERVICE_ID = 777000L;

    /** Bir xil chat haqida log'ni takror yozmaslik uchun. */
    private static final HashSet<Long> loggedHidden = new HashSet<>();

    private Allowlist() {
    }

    /**
     * Dialoglar ro'yxatidan ruxsatsizlarini olib tashlaydi.
     * sortDialogs() ichida chaqiriladi — allDialogs faqat shu yerda qayta
     * yig'ilgani uchun, bu yagona tor joy.
     */
    public static void prune(int currentAccount, ArrayList<TLRPC.Dialog> dialogs) {
        if (!ENABLED || dialogs == null || dialogs.isEmpty()) {
            return;
        }
        if (ALLOWED.length == 0) {
            // Bo'sh ro'yxat bilan hamma narsani yashirish ilovani
            // ishlatib bo'lmas holga keltiradi. Bu xato, filtr emas.
            return;
        }
        for (int i = dialogs.size() - 1; i >= 0; i--) {
            TLRPC.Dialog dialog = dialogs.get(i);
            if (dialog == null) {
                continue;
            }
            if (!isAllowed(currentAccount, dialog.id)) {
                dialogs.remove(i);
            }
        }
    }

    /**
     * Shu chat ko'rinishi kerakmi?
     * Tarmoqqa so'rov yubormaydi — faqat ilovaning o'z keshidan o'qiydi.
     */
    public static boolean isAllowed(int currentAccount, long dialogId) {
        if (!ENABLED || ALLOWED.length == 0) {
            return true;
        }
        if (dialogId == 0) {
            return true;
        }
        if (dialogId == TELEGRAM_SERVICE_ID) {
            return true;
        }
        // Saved Messages — o'zining chati, doim ochiq.
        if (dialogId == UserConfig.getInstance(currentAccount).getClientUserId()) {
            return true;
        }

        String username = null;
        String title = null;
        try {
            MessagesController controller = MessagesController.getInstance(currentAccount);
            if (DialogObject.isUserDialog(dialogId)) {
                TLRPC.User user = controller.getUser(dialogId);
                if (user != null) {
                    username = UserObject.getPublicUsername(user);
                    title = UserObject.getUserName(user);
                }
            } else if (DialogObject.isChatDialog(dialogId)) {
                TLRPC.Chat chat = controller.getChat(-dialogId);
                if (chat != null) {
                    username = ChatObject.getPublicUsername(chat);
                    title = chat.title;
                }
            }
        } catch (Exception e) {
            FileLog.e(e);
        }

        String idText = Long.toString(dialogId);
        for (String entry : ALLOWED) {
            if (entry == null || entry.length() == 0) {
                continue;
            }
            String value = entry.trim();
            if (value.startsWith("@")) {
                if (username != null && username.equalsIgnoreCase(value.substring(1))) {
                    return true;
                }
            } else if (isNumeric(value)) {
                if (idText.equals(value)) {
                    return true;
                }
            } else if (title != null && title.equalsIgnoreCase(value)) {
                return true;
            }
        }

        logHiddenOnce(dialogId, username, title);
        return false;
    }

    private static boolean isNumeric(String value) {
        if (value.length() == 0) {
            return false;
        }
        int start = (value.charAt(0) == '-') ? 1 : 0;
        if (start >= value.length()) {
            return false;
        }
        for (int i = start; i < value.length(); i++) {
            if (!Character.isDigit(value.charAt(i))) {
                return false;
            }
        }
        return true;
    }

    /**
     * Yashirilgan chatni bir marta log'ga yozadi.
     * Oq ro'yxatga qo'shish uchun kerak bo'ladigan ID va username shu yerdan
     * olinadi: Sozlamalar -> Debug -> jurnalni eksport qilish.
     * Xabar matni hech qachon yozilmaydi.
     */
    private static void logHiddenOnce(long dialogId, String username, String title) {
        if (!BuildVars.LOGS_ENABLED) {
            return;
        }
        synchronized (loggedHidden) {
            if (!loggedHidden.add(dialogId)) {
                return;
            }
        }
        FileLog.d(String.format(Locale.US,
                "qorgon: yashirildi id=%d username=%s title=%s",
                dialogId,
                username == null ? "-" : "@" + username,
                title == null ? "-" : title));
    }
}
