/**
 * Bot mantiqi.
 *
 * Bot ikki xil manba bilan gaplashadi:
 *   - oila a'zosining telefonidagi Qo'rg'on ilovasi (protokol bo'yicha)
 *   - admin, ya'ni siz (buyruqlar va tugmalar bilan)
 *
 * Muhim: admin ham o'z telefonida Qo'rg'on ishlatishi mumkin. Shunda ikkala
 * oqim BITTA chatdan keladi. Shuning uchun "kim yozdi" degan savol yetarli
 * emas — xabarning SHAKLI hal qiladi:
 *
 *   protokolga kirsa  -> ilova yozgan
 *   /buyruq bo'lsa    -> odam yozgan
 */

import { Bot, InlineKeyboard, type CommandContext, type Context } from "grammy";
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

async function notifyAdmin(text: string, keyboard?: InlineKeyboard): Promise<void> {
  try {
    await bot.api.sendMessage(
      config.adminId,
      text,
      keyboard ? { reply_markup: keyboard } : undefined
    );
  } catch (error) {
    console.error("adminga yuborib bo‘lmadi:", error);
  }
}

/* ------------------------------------------------------------------
 * 1) Ilovadan kelgan protokol xabarlari — kim yuborganidan qat'i nazar
 * ------------------------------------------------------------------ */

bot.on("message:text", async (ctx, next) => {
  const chatId = ctx.chat.id;
  const parsed = parseAppMessage(ctx.message.text);

  // Protokolga kirmasa — odam yozgan. Quyidagi buyruq handlerlariga o'tadi.
  if (!parsed) {
    if (!isAdmin(ctx.from?.id)) {
      // Sozlashda kerak: ADMIN_ID ni bilmasangiz shu qatordan oling.
      console.log(`protokolga kirmagan xabar: from.id=${ctx.from?.id} chat.id=${chatId}`);
    }
    return next();
  }

  upsertMember(chatId, ctx.from?.first_name ?? "", ctx.from?.username ?? null);
  touchMember(chatId);

  switch (parsed.kind) {
    case "start":
      await notifyAdmin(`Qurilma ulandi: ${memberTitle(chatId)}`);
      // Darhol holatni so'raymiz, ro'yxat bo'sh ko'rinmasligi uchun.
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

/* ------------------------------------------------------------------
 * 2) Admin tugmalari
 * ------------------------------------------------------------------ */

function logById(id: number) {
  return db.prepare("SELECT * FROM log WHERE id = ?").get(id) as
    | { id: number; chat_id: number; dialog_id: string; who: string }
    | undefined;
}

bot.callbackQuery(/^allow:(\d+)$/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCallbackQuery("Ruxsat yo‘q.");
  const row = logById(Number(ctx.match[1]));
  if (!row) return ctx.answerCallbackQuery("Topilmadi.");

  await sendCommand(row.chat_id, command.add(row.dialog_id));
  markLogHandled(row.id);
  await ctx.answerCallbackQuery("Ruxsat berildi.");
  await ctx.editMessageReplyMarkup({ reply_markup: undefined });
});

bot.callbackQuery(/^skip:(\d+)$/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCallbackQuery("Ruxsat yo‘q.");
  markLogHandled(Number(ctx.match[1]));
  await ctx.answerCallbackQuery("E’tiborsiz qoldirildi.");
  await ctx.editMessageReplyMarkup({ reply_markup: undefined });
});

// Qaysi telefonga qo'llashni tanlash (bir nechta qurilma bo'lganda).
bot.callbackQuery(/^apply:(add|del):(-?\d+):(.+)$/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCallbackQuery("Ruxsat yo‘q.");
  const [, action, chatId, value] = ctx.match;
  await sendCommand(
    Number(chatId),
    action === "add" ? command.add(value) : command.remove(value)
  );
  await ctx.answerCallbackQuery("Yuborildi.");
  await ctx.editMessageText(
    `${action === "add" ? "Qo‘shildi" : "Olib tashlandi"}: ${value}\n${memberTitle(Number(chatId))}`
  );
});

/* ------------------------------------------------------------------
 * 3) Admin buyruqlari
 * ------------------------------------------------------------------ */

const HELP =
  "Qo‘rg‘on boshqaruvi.\n\n" +
  "/qosh @username — chatga ruxsat berish\n" +
  "/olib @username — ruxsatni olib tashlash\n" +
  "/royxat — har bir telefondagi oq ro‘yxat\n" +
  "/qurilmalar — ulangan telefonlar\n" +
  "/yangila — holatni telefonlardan qayta so‘rash\n\n" +
  "@username o‘rniga raqamli ID yoki chatning aniq sarlavhasi ham bo‘ladi.";

bot.command("start", async (ctx) => {
  if (!isAdmin(ctx.from?.id)) return;
  const keyboard = config.publicUrl
    ? new InlineKeyboard().webApp("Boshqaruv paneli", config.publicUrl)
    : undefined;
  await ctx.reply(HELP, keyboard ? { reply_markup: keyboard } : undefined);
});

bot.command("help", async (ctx) => {
  if (!isAdmin(ctx.from?.id)) return;
  await ctx.reply(HELP);
});

bot.command("qurilmalar", async (ctx) => {
  if (!isAdmin(ctx.from?.id)) return;
  const members = listMembers();
  if (members.length === 0) {
    return ctx.reply(
      "Hali hech qanday telefon ulanmagan.\n\n" +
        "Telefonga Qo‘rg‘on o‘rnatilgach, ilova botga o‘zi ulanadi."
    );
  }
  const lines = members.map((m) => `• ${memberTitle(m.chat_id)} (${m.chat_id})`);
  await ctx.reply(lines.join("\n"));
});

bot.command("yangila", async (ctx) => {
  if (!isAdmin(ctx.from?.id)) return;
  const members = listMembers();
  if (members.length === 0) return ctx.reply("Hali hech qanday telefon ulanmagan.");
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
    const title = memberTitle(m.chat_id);
    if (!cached || cached.entries.length === 0) {
      return `${title}: ma’lumot yo‘q (/yangila)`;
    }
    return `${title}:\n` + cached.entries.map((e) => `  • ${e}`).join("\n");
  });
  await ctx.reply(blocks.join("\n\n"));
});

/** /qosh va /olib — mini app ochilmaganda ham ishlaydi. */
async function applyCommand(ctx: CommandContext<Context>, action: "add" | "del") {
  if (!isAdmin(ctx.from?.id)) return;
  const value = ctx.match.trim();
  if (!value) {
    return ctx.reply(
      action === "add"
        ? "Nimani qo‘shay? Masalan:\n/qosh @jahongir_on_blog"
        : "Nimani olib tashlay? Masalan:\n/olib @jahongir_on_blog"
    );
  }

  const members = listMembers();
  if (members.length === 0) {
    return ctx.reply("Hali hech qanday telefon ulanmagan.");
  }

  if (members.length === 1) {
    const chatId = members[0].chat_id;
    await sendCommand(chatId, action === "add" ? command.add(value) : command.remove(value));
    return ctx.reply(
      `${action === "add" ? "Qo‘shildi" : "Olib tashlandi"}: ${value}\n` +
        `${memberTitle(chatId)}\n\nTelefonda bir necha soniyada ko‘rinadi.`
    );
  }

  // Bir nechta telefon bor — qaysisiga qo'llashni so'raymiz.
  const keyboard = new InlineKeyboard();
  for (const member of members) {
    keyboard.text(memberTitle(member.chat_id), `apply:${action}:${member.chat_id}:${value}`).row();
  }
  await ctx.reply(`"${value}" — qaysi telefonga?`, { reply_markup: keyboard });
}

bot.command("qosh", (ctx) => applyCommand(ctx, "add"));
bot.command("olib", (ctx) => applyCommand(ctx, "del"));

bot.catch((error) => {
  console.error("bot xatosi:", error);
});
