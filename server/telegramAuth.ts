import crypto from "node:crypto";
export type AuthUser = {
  id: number;
  username?: string;
  displayName: string;
  allowsWriteToPm?: boolean;
};
export const validateTelegramInitData = (
  initData: string,
  botToken: string,
): AuthUser => {
  if (!initData) throw new Error("Telegram initData is required.");

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date") || 0);
  if (!hash || !authDate) throw new Error("Invalid Telegram initData.");
  if (Math.abs(Date.now() / 1000 - authDate) > 7 * 86400)
    throw new Error(
      "Telegram session expired. Reopen the Mini App from the bot.",
    );

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => key + "=" + value)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const calculated = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const a = Buffer.from(calculated, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Telegram signature verification failed.");
  }

  const userRaw = params.get("user");
  if (!userRaw) throw new Error("Telegram user is missing.");
  const user = JSON.parse(userRaw);

  if (!Number.isSafeInteger(Number(user.id)) || Number(user.id) <= 0)
    throw new Error("Invalid Telegram user ID.");
  return {
    id: Number(user.id),
    username: user.username,
    allowsWriteToPm: user.allows_write_to_pm === true,
    displayName:
      [user.first_name, user.last_name].filter(Boolean).join(" ") ||
      user.username ||
      "Игрок",
  };
};
