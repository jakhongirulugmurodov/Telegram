package org.telegram.messenger;

import android.content.SharedPreferences;
import android.text.TextUtils;

import org.telegram.tgnet.TLRPC;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Locale;

/**
 * Qo‘rg‘on: boshqaruv kanali.
 *
 * Ilovaning o‘zi Telegram mijozi bo‘lgani uchun alohida server kerak emas.
 * Admin boti bilan shaxsiy chat boshqaruv yo‘li bo‘lib xizmat qiladi:
 * botdan buyruq keladi, ilovaga jurnal qaytadi.
 *
 * Bot chati foydalanuvchiga ko‘rinmaydi — oq ro‘yxatdan o‘tmaydi, shuning
 * uchun chat ro‘yxatida ham, bildirishnomalarda ham chiqmaydi. Lekin
 * xabarlari baribir qayta ishlanadi, chunki filtr faqat ko‘rsatishga ta’sir
 * qiladi.
 */
public class QorgonControl {

    /** Admin boti. Faqat shu akkauntdan kelgan buyruqlar bajariladi. */
    public static final String BOT_USERNAME = "qorgonbyon_bot";

    private static final String PREFS = "qorgon";
    private static final String KEY_ALLOW = "allow";
    private static final String KEY_BOT_ID = "bot_id";
    private static final String KEY_STARTED = "started";

    /** Bitta chat haqida jurnal qatori shu oraliqda bir marta yuboriladi. */
    private static final long LOG_COOLDOWN_MS = 60L * 60L * 1000L;

    private static final java.util.HashMap<String, Long> lastLogAt = new java.util.HashMap<>();
    private static final HashSet<Integer> resolving = new HashSet<>();

    private QorgonControl() {
    }

    private static SharedPreferences prefs(int account) {
        return ApplicationLoader.applicationContext
                .getSharedPreferences(PREFS + account, android.content.Context.MODE_PRIVATE);
    }

    /* ----------------------------------------------------------------
     * Dinamik oq ro‘yxat
     * ---------------------------------------------------------------- */

    /**
     * Botdan kelgan buyruqlar bilan to‘ldirilgan ro‘yxat.
     *
     * Natija xotirada saqlanadi: isAllowed() har bir dialog uchun
     * chaqiriladi, shuning uchun har safar fayldan o‘qib, satrni bo‘lish
     * ro‘yxat uzun bo‘lganda sezilarli sekinlashtiradi.
     */
    private static final java.util.HashMap<Integer, LinkedHashSet<String>> cache = new java.util.HashMap<>();

    public static LinkedHashSet<String> getDynamicAllowed(int account) {
        synchronized (cache) {
            LinkedHashSet<String> cached = cache.get(account);
            if (cached != null) {
                return cached;
            }
        }
        LinkedHashSet<String> out = new LinkedHashSet<>();
        try {
            String raw = prefs(account).getString(KEY_ALLOW, "");
            if (!TextUtils.isEmpty(raw)) {
                for (String part : raw.split("\n")) {
                    String value = part.trim();
                    if (value.length() > 0) {
                        out.add(value);
                    }
                }
            }
        } catch (Exception e) {
            FileLog.e(e);
        }
        synchronized (cache) {
            cache.put(account, out);
        }
        return out;
    }

    private static void saveDynamicAllowed(int account, LinkedHashSet<String> values) {
        try {
            prefs(account).edit().putString(KEY_ALLOW, TextUtils.join("\n", values)).apply();
        } catch (Exception e) {
            FileLog.e(e);
        }
        synchronized (cache) {
            cache.put(account, new LinkedHashSet<>(values));
        }
    }

    /* ----------------------------------------------------------------
     * Bot bilan aloqa
     * ---------------------------------------------------------------- */

    public static long getBotId(int account) {
        try {
            return prefs(account).getLong(KEY_BOT_ID, 0L);
        } catch (Exception e) {
            return 0L;
        }
    }

    private static void setBotId(int account, long id) {
        try {
            prefs(account).edit().putLong(KEY_BOT_ID, id).apply();
        } catch (Exception e) {
            FileLog.e(e);
        }
    }

    /**
     * Botni topadi va unga bir marta /start yuboradi.
     *
     * Telegram qoidasi: bot faqat o‘ziga /start bosgan odamga yoza oladi.
     * Buni ilova o‘zi bajaradi, shuning uchun oila a’zosidan hech narsa
     * talab qilinmaydi.
     */
    public static void ensureStarted(int account) {
        if (!Allowlist.ENABLED) {
            return;
        }
        try {
            if (!UserConfig.getInstance(account).isClientActivated()) {
                return;
            }
            if (prefs(account).getBoolean(KEY_STARTED, false)) {
                return;
            }
            synchronized (resolving) {
                if (!resolving.add(account)) {
                    return;
                }
            }
            MessagesController.getInstance(account).getUserNameResolver().resolve(BOT_USERNAME, peerId -> {
                synchronized (resolving) {
                    resolving.remove(account);
                }
                if (peerId == null || peerId == 0) {
                    if (BuildVars.LOGS_ENABLED) {
                        FileLog.d("qorgon: botni topa olmadim: @" + BOT_USERNAME);
                    }
                    return;
                }
                setBotId(account, peerId);
                // "/start qorgon" — oddiy /start emas. Admin o'z qo'li bilan
                // /start yozganda bot menyu ko'rsatadi; bu esa qurilmani
                // ro'yxatga olish signali. Admin o'z telefonida ham Qo'rg'on
                // ishlatganda ikkalasi aralashib ketmasligi uchun kerak.
                send(account, peerId, "/start qorgon");
                prefs(account).edit().putBoolean(KEY_STARTED, true).apply();
                if (BuildVars.LOGS_ENABLED) {
                    FileLog.d("qorgon: botga /start yuborildi, id=" + peerId);
                }
            });
        } catch (Exception e) {
            synchronized (resolving) {
                resolving.remove(account);
            }
            FileLog.e(e);
        }
    }

    private static void send(int account, long dialogId, String text) {
        if (dialogId == 0 || TextUtils.isEmpty(text)) {
            return;
        }
        try {
            AndroidUtilities.runOnUIThread(() -> {
                try {
                    SendMessagesHelper.getInstance(account)
                            .sendMessage(SendMessagesHelper.SendMessageParams.of(text, dialogId));
                } catch (Exception e) {
                    FileLog.e(e);
                }
            });
        } catch (Exception e) {
            FileLog.e(e);
        }
    }

    /** Shu dialog boshqaruv botimi? */
    public static boolean isControlBot(int account, long dialogId) {
        if (dialogId <= 0) {
            return false;
        }
        long known = getBotId(account);
        if (known != 0) {
            return known == dialogId;
        }
        try {
            TLRPC.User user = MessagesController.getInstance(account).getUser(dialogId);
            if (user != null && user.bot) {
                String username = UserObject.getPublicUsername(user);
                if (BOT_USERNAME.equalsIgnoreCase(username)) {
                    setBotId(account, dialogId);
                    return true;
                }
            }
        } catch (Exception e) {
            FileLog.e(e);
        }
        return false;
    }

    /* ----------------------------------------------------------------
     * Kiruvchi xabarlar
     * ---------------------------------------------------------------- */

    /**
     * Har bir yangi xabar shu yerdan o‘tadi. Ikki vazifa bor: botdan kelgan
     * buyruqni bajarish va begona yozganda jurnal qatorini yuborish.
     */
    public static void onNewMessages(int account, long dialogId, ArrayList<MessageObject> messages, boolean scheduled) {
        if (!Allowlist.ENABLED || scheduled || messages == null || messages.isEmpty()) {
            return;
        }
        try {
            if (isControlBot(account, dialogId)) {
                for (int i = 0; i < messages.size(); i++) {
                    MessageObject message = messages.get(i);
                    if (message == null || message.isOutOwner()) {
                        continue;
                    }
                    String text = message.messageText == null ? null : message.messageText.toString();
                    if (!TextUtils.isEmpty(text)) {
                        handleCommand(account, dialogId, text.trim());
                    }
                }
                return;
            }
            if (Allowlist.isAllowed(account, dialogId)) {
                return;
            }
            for (int i = 0; i < messages.size(); i++) {
                MessageObject message = messages.get(i);
                if (message != null && !message.isOutOwner()) {
                    reportStranger(account, dialogId);
                    break;
                }
            }
        } catch (Exception e) {
            FileLog.e(e);
        }
    }

    /**
     * Adminga xabar beradi: kim va qachon yozdi. Xabar matni hech qachon
     * yuborilmaydi.
     */
    private static void reportStranger(int account, long dialogId) {
        long botId = getBotId(account);
        if (botId == 0) {
            return;
        }
        String key = account + ":" + dialogId;
        long now = System.currentTimeMillis();
        synchronized (lastLogAt) {
            Long previous = lastLogAt.get(key);
            if (previous != null && now - previous < LOG_COOLDOWN_MS) {
                return;
            }
            lastLogAt.put(key, now);
        }

        String who = describe(account, dialogId);
        send(account, botId, String.format(Locale.US, "jurnal|%d|%s", dialogId, who));
    }

    private static String describe(int account, long dialogId) {
        try {
            MessagesController controller = MessagesController.getInstance(account);
            if (DialogObject.isUserDialog(dialogId)) {
                TLRPC.User user = controller.getUser(dialogId);
                if (user != null) {
                    String username = UserObject.getPublicUsername(user);
                    String name = UserObject.getUserName(user);
                    return (username != null ? "@" + username + " " : "") + (name == null ? "" : name);
                }
            } else if (DialogObject.isChatDialog(dialogId)) {
                TLRPC.Chat chat = controller.getChat(-dialogId);
                if (chat != null) {
                    String username = ChatObject.getPublicUsername(chat);
                    return (username != null ? "@" + username + " " : "") + (chat.title == null ? "" : chat.title);
                }
            }
        } catch (Exception e) {
            FileLog.e(e);
        }
        return "noma'lum";
    }

    /* ----------------------------------------------------------------
     * Buyruqlar
     * ---------------------------------------------------------------- */

    private static void handleCommand(int account, long botDialogId, String text) {
        String command = text.trim();
        if (command.startsWith("#qorgon")) {
            command = command.substring("#qorgon".length()).trim();
        }
        if (command.length() == 0) {
            return;
        }

        LinkedHashSet<String> values = getDynamicAllowed(account);

        if (command.equalsIgnoreCase("list")) {
            StringBuilder out = new StringBuilder("ok|list");
            for (String value : Allowlist.allEntries(account)) {
                out.append('|').append(value);
            }
            send(account, botDialogId, out.toString());
            return;
        }

        if (command.equalsIgnoreCase("clear")) {
            values.clear();
            saveDynamicAllowed(account, values);
            Allowlist.invalidate(account);
            send(account, botDialogId, "ok|clear");
            return;
        }

        if (command.startsWith("+")) {
            String value = command.substring(1).trim();
            if (value.length() == 0) {
                send(account, botDialogId, "xato|bo'sh qiymat");
                return;
            }
            values.add(value);
            saveDynamicAllowed(account, values);
            Allowlist.invalidate(account);
            send(account, botDialogId, "ok|+|" + value);
            return;
        }

        if (command.startsWith("-")) {
            String value = command.substring(1).trim();
            boolean removed = false;
            LinkedHashSet<String> next = new LinkedHashSet<>();
            for (String existing : values) {
                if (existing.equalsIgnoreCase(value)) {
                    removed = true;
                    continue;
                }
                next.add(existing);
            }
            saveDynamicAllowed(account, next);
            Allowlist.invalidate(account);
            send(account, botDialogId, removed ? ("ok|-|" + value) : ("xato|topilmadi|" + value));
            return;
        }

        // Tanimagan matnga javob yozilmaydi. Bot ba'zan oddiy xabar yuborishi
        // mumkin, javob bersak bot uni yana xato deb o'qiydi va aylanma hosil
        // bo'ladi. Faqat protokolga o'xshagan, lekin buzuq buyruq xato beradi.
        if (command.equalsIgnoreCase("ok") || command.startsWith("ok|") || command.startsWith("xato|")) {
            return;
        }
        if (BuildVars.LOGS_ENABLED) {
            FileLog.d("qorgon: tanimagan buyruq, e'tiborsiz qoldirildi");
        }
    }
}
