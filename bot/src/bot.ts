/**
 * Bot mantiqi.
 *
 * Ikki xil odam bilan gaplashadi:
 *   - oila a'zosining telefonidagi Qo'rg'on ilovasi (protokol bo'yicha)
 *   - admin, ya'ni siz (tugmalar va mini app bilan)
 *
 * Admin kimligi faqat ADMIN_ID bilan aniqlanadi.
 */

import { Bot, InlineKeyboard } from "grammy";
import { config } from "./config.js";
import { command, parseAppMessage } from "./protocol.js";
import {
  addLog,
  db,
  getAllowlist,
  getMember,
  listMembers,
  markLogHandled,
  saveAllowlist,
  touchMember,
  upsertMember,
} from "./db.js";

export const bot = new Bot(config.botToken);

const isAdmin = (id: number | undefined) => id === config.adminId;

/** Ilovaga buyruq yuborish. API ham shu funksiyani ishlatadi. */
export async function sendCommand(chatId: number, text: string): Promise<void> {
  await bot.api.sendMessage(chatId, text);
}

function memberTitle(chatId: number): string {
  const member = getMember(chatId);
  if (!member) return String(chatId);
  return member.label || member.name || member.username || String(chatId);
}

/* ------------------------------------------------------------------
 * Oila a'zosining ilovasidan kelgan xabarlar
 * ------------------------------------------------------------------ */

bot.on("message:text", async (ctx, next) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text;

  // Admin xabarlari pastdagi handlerlarga o'tadi.
  if (isAdmin(ctx.from?.id)) return next();

  const parsed = parseAppMessage(text);
  if (!parsed) return;

  upsertMember(chatId, ctx.from?.first_name ?? "", ctx.from?.username ?? null);
  touchMember(chatId);

  switch (parsed.kind) {
    case "start":
      // Oila a'zosining chatiga oddiy matn yozilmaydi: ilova uni buyruq deb
      // o'qishga urinadi. Faqat protokol xabarlari yuboriladi.
      await notifyAdmin(`Yangi qurilma ulandi: ${memberTitle(chatId)}`);
      // Darhol holatni so'raymiz, mini app bo'sh ko'rinmasligi uchun.
      await sendCommand(chatId, command.list());
      break;

    case "log": {
      const id = addLog(chatId, parsed.dialogId, parsed.who);
      const keyboard = new InlineKeyboard()
        .text("Ruxsat berish", `allow:${id}`)
        .text("E’tiborsiz", `skip:${id}`);
      await notifyAdmin(
        `${memberTitle(chatId)} ga begona yozdi:\n${parsed.who}\n\nID: ${parsed.dialogId}`,
        keyboard
      );
      break;
    }

    case "ok":
      if (parsed.action === "list") {
        saveAllowlist(chatId, parsed.entries);
      } else {
        // Ro'yxat o'zgardi — yangi holatni so'raymiz.
        await sendCommand(chatId, command.list());
      }
      break;

    case "error":
      await notifyAdmin(`${memberTitle(chatId)}: xato — ${parsed.reason}`);
      break;
  }
});

async function notifyAdmin(text: string, keyboard?: InlineKeyboard): Promise<void> {
  try {
    await bot.api.sendMessage(config.adminId, text, keyboard ? { reply_markup: keyboard } : undefined);
  } catch (error) {
    console.error("adminga yuborib bo‘lmadi:", error);
  }
}

/* ------------------------------------------------------------------
 * Admin tugmalari
 * ------------------------------------------------------------------ */

bot.callbackQuery(/^allow:(\d+)$/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCallbackQuery("Ruxsat yo‘q.");
  const id = Number(ctx.match[1]);
  const row = recentLogById(id);
  if (!row) return ctx.answerCallbackQuery("Topilmadi.");

  await sendCommand(row.chat_id, command.add(row.dialog_id));
  markLogHandled(id);
  await ctx.answerCallbackQuery("Ruxsat berildi.");
  await ctx.editMessageReplyMarkup({ reply_markup: undefined });
});

bot.callbackQuery(/^skip:(\d+)$/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCallbackQuery("Ruxsat yo‘q.");
  markLogHandled(Number(ctx.match[1]));
  await ctx.answerCallbackQuery("E’tiborsiz qoldirildi.");
  await ctx.editMessageReplyMarkup({ reply_markup: undefined });
});

function recentLogById(id: number) {
  return db.prepare("SELECT * FROM log WHERE id = ?").get(id) as
    | { id: number; chat_id: number; dialog_id: string; who: string }
    | undefined;
}

/* ------------------------------------------------------------------
 * Admin buyruqlari
 * ------------------------------------------------------------------ */

bot.command("start", async (ctx) => {
  if (!isAdmin(ctx.from?.id)) return;
  const keyboard = config.publicUrl
    ? new InlineKeyboard().webApp("Boshqaruv paneli", config.publicUrl)
    : undefined;
  await ctx.reply(
    "Qo‘rg‘on boshqaruvi.\n\n" +
      "/qurilmalar — ulangan telefonlar\n" +
      "/royxat — har bir telefondagi oq ro‘yxat\n" +
      "/yangila — holatni telefonlardan qayta so‘rash",
    keyboard ? { reply_markup: keyboard } : undefined
  );
});

bot.command("qurilmalar", async (ctx) => {
  if (!isAdmin(ctx.from?.id)) return;
  const members = listMembers();
  if (members.length === 0) {
    return ctx.reply("Hali hech qanday telefon ulanmagan.");
  }
  const lines = members.map((m) => `• ${m.label || m.name || m.username || m.chat_id} (${m.chat_id})`);
  await ctx.reply(lines.join("\n"));
});

bot.command("yangila", async (ctx) => {
  if (!isAdmin(ctx.from?.id)) return;
  const members = listMembers();
  for (const member of members) {
    await sendCommand(member.chat_id, command.list());
  }
  await ctx.reply(`${members.length} ta telefondan holat so‘raldi.`);
});

bot.command("royxat", async (ctx) => {
  if (!isAdmin(ctx.from?.id)) return;
  const members = listMembers();
  if (members.length === 0) return ctx.reply("Hali hech qanday telefon ulanmagan.");

  const blocks = members.map((m) => {
    const cached = getAllowlist(m.chat_id);
    const title = m.label || m.name || String(m.chat_id);
    if (!cached || cached.entries.length === 0) {
      return `${title}: ma’lumot yo‘q (/yangila)`;
    }
    return `${title}:\n` + cached.entries.map((e) => `  • ${e}`).join("\n");
  });
  await ctx.reply(blocks.join("\n\n"));
});

bot.catch((error) => {
  console.error("bot xatosi:", error);
});
