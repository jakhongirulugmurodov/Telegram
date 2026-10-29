/**
 * Sozlamalar. Hammasi muhit o‘zgaruvchilaridan o‘qiladi — kodda hech qanday
 * kalit yoki ID yozilmaydi.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} muhit o‘zgaruvchisi yo‘q. .env.example ga qarang.`);
  }
  return value.trim();
}

export const config = {
  /** BotFather bergan token. Hech qachon kodga yozilmaydi. */
  botToken: required("BOT_TOKEN"),

  /**
   * Admin Telegram user id (raqam). Faqat shu odam boshqara oladi.
   * Bilmasangiz: botni ishga tushiring, botga yozing, log'da id ko'rinadi.
   */
  adminId: Number(required("ADMIN_ID")),

  /** Mini app va API shu portda. */
  port: Number(process.env.PORT ?? 8080),

  /**
   * Mini app ochiq turadigan manzil (https). BotFather'ga shu manzil
   * beriladi. Bo'sh bo'lsa mini app tugmasi ko'rsatilmaydi.
   */
  publicUrl: (process.env.PUBLIC_URL ?? "").replace(/\/+$/, ""),

  /** SQLite fayli. Docker'da volume'ga ulanadi. */
  dbPath: process.env.DB_PATH ?? "./data/qorgon.db",
};

if (!Number.isFinite(config.adminId) || config.adminId <= 0) {
  throw new Error("ADMIN_ID butun son bo‘lishi kerak.");
}
