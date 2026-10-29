/**
 * Mini app uchun HTTP API.
 *
 * Kirish nazorati: Telegram Mini App har bir so‘rovda `initData` yuboradi,
 * u bot tokeni bilan imzolangan. Imzoni tekshiramiz va faqat ADMIN_ID
 * bo‘lsa o‘tkazamiz. Ya’ni havolani bilgan boshqa odam hech narsa qila
 * olmaydi.
 */

import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config.js";
import { command } from "./protocol.js";
import { sendCommand } from "./bot.js";
import { getAllowlist, listMembers, recentLog, setLabel } from "./db.js";

/** Telegram WebApp initData imzosini tekshiradi. */
function verifyInitData(initData: string): { ok: boolean; userId?: number } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return { ok: false };
    params.delete("hash");

    const checkString = [...params.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secret = createHmac("sha256", "WebAppData").update(config.botToken).digest();
    const computed = createHmac("sha256", secret).update(checkString).digest("hex");

    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(hash, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false };

    // Eski initData qabul qilinmaydi (24 soat).
    const authDate = Number(params.get("auth_date") ?? 0);
    if (!authDate || Date.now() / 1000 - authDate > 86400) return { ok: false };

    const user = JSON.parse(params.get("user") ?? "{}");
    return { ok: true, userId: Number(user.id) };
  } catch {
    return { ok: false };
  }
}

export const api = new Hono();

api.use("/api/*", async (c, next) => {
  const initData = c.req.header("X-Init-Data") ?? "";
  const result = verifyInitData(initData);
  if (!result.ok || result.userId !== config.adminId) {
    return c.json({ error: "ruxsat yo‘q" }, 403);
  }
  await next();
});

/** Hamma telefonlar, ularning oq ro‘yxati va oxirgi jurnal. */
api.get("/api/state", (c) => {
  const members = listMembers().map((m) => {
    const cached = getAllowlist(m.chat_id);
    return {
      chatId: m.chat_id,
      title: m.label || m.name || m.username || String(m.chat_id),
      username: m.username,
      label: m.label,
      seenAt: m.seen_at,
      allowlist: cached?.entries ?? [],
      allowlistUpdatedAt: cached?.updatedAt ?? null,
    };
  });
  return c.json({ members, log: recentLog(50) });
});

api.post("/api/allow", async (c) => {
  const { chatId, value } = await c.req.json<{ chatId: number; value: string }>();
  if (!chatId || !value?.trim()) return c.json({ error: "chatId va value kerak" }, 400);
  await sendCommand(chatId, command.add(value));
  return c.json({ ok: true });
});

api.post("/api/deny", async (c) => {
  const { chatId, value } = await c.req.json<{ chatId: number; value: string }>();
  if (!chatId || !value?.trim()) return c.json({ error: "chatId va value kerak" }, 400);
  await sendCommand(chatId, command.remove(value));
  return c.json({ ok: true });
});

api.post("/api/refresh", async (c) => {
  const { chatId } = await c.req.json<{ chatId?: number }>();
  const targets = chatId ? [chatId] : listMembers().map((m) => m.chat_id);
  for (const id of targets) {
    await sendCommand(id, command.list());
  }
  return c.json({ ok: true, count: targets.length });
});

api.post("/api/label", async (c) => {
  const { chatId, label } = await c.req.json<{ chatId: number; label: string }>();
  if (!chatId) return c.json({ error: "chatId kerak" }, 400);
  setLabel(chatId, (label ?? "").trim());
  return c.json({ ok: true });
});

// Mini app sahifasi.
api.use("/*", serveStatic({ root: "./web" }));
