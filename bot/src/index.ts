/**
 * Kirish nuqtasi: botni va mini app serverini birga ishga tushiradi.
 */

import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { bot } from "./bot.js";
import { api } from "./api.js";

serve({ fetch: api.fetch, port: config.port }, (info) => {
  console.log(`mini app: http://localhost:${info.port}`);
  if (!config.publicUrl) {
    console.warn("PUBLIC_URL yo‘q — bot ichidagi panel tugmasi ko‘rsatilmaydi.");
  }
});

bot
  .start({
    onStart: (info) => console.log(`bot ishga tushdi: @${info.username}`),
  })
  .catch((error) => {
    // Eng ko'p uchraydigan sabab — BOT_TOKEN xato. Buni jimgina
    // qoldirmaymiz, aks holda bot "ishlayapti"dek ko'rinadi.
    console.error("bot ishga tushmadi. BOT_TOKEN to'g'rimi?");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });

const stop = async () => {
  await bot.stop();
  process.exit(0);
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
