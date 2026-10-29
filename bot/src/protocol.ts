/**
 * Ilova bilan gaplashish tili. To‘liq tavsifi — SPEC.md.
 *
 * Shu faylni o‘zgartirsangiz, ilova tomonidagi QorgonControl.java ni ham
 * o‘zgartiring. Ikkalasi bir vaqtda o‘zgarishi shart.
 */

export type AppMessage =
  | { kind: "start" }
  | { kind: "log"; dialogId: string; who: string }
  | { kind: "ok"; action: "list"; entries: string[] }
  | { kind: "ok"; action: "add" | "remove"; value: string }
  | { kind: "ok"; action: "clear" }
  | { kind: "error"; reason: string };

/** Ilovadan kelgan xabarni tushunishga urinadi. Tushunmasa null. */
export function parseAppMessage(text: string): AppMessage | null {
  const line = text.trim();
  if (line.length === 0) return null;
  // Ilova "/start qorgon" yuboradi. Admin o'z qo'li bilan yozgan oddiy
  // "/start" bu emas — u menyu so'ragan bo'ladi.
  if (line === "/start qorgon") return { kind: "start" };

  const parts = line.split("|");
  const head = parts[0];

  if (head === "jurnal" && parts.length >= 3) {
    return { kind: "log", dialogId: parts[1], who: parts.slice(2).join("|") };
  }

  if (head === "ok") {
    const action = parts[1];
    if (action === "list") {
      return { kind: "ok", action: "list", entries: parts.slice(2).filter((p) => p.length > 0) };
    }
    if (action === "clear") {
      return { kind: "ok", action: "clear" };
    }
    if (action === "+" && parts.length >= 3) {
      return { kind: "ok", action: "add", value: parts.slice(2).join("|") };
    }
    if (action === "-" && parts.length >= 3) {
      return { kind: "ok", action: "remove", value: parts.slice(2).join("|") };
    }
    return null;
  }

  if (head === "xato") {
    return { kind: "error", reason: parts.slice(1).join("|") || "noma’lum" };
  }

  return null;
}

/** Ilovaga yuboriladigan buyruqlar. */
export const command = {
  add: (value: string) => `+${value.trim()}`,
  remove: (value: string) => `-${value.trim()}`,
  list: () => "list",
  clear: () => "clear",
};
