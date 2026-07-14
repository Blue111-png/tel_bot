// Central place for all secrets/settings.
// Never hardcode real secrets in source control — read them from the environment.
//
// These now come from your .env file (loaded via `node --env-file=.env bot.js`).

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN || "PUT_YOUR_TOKEN_HERE",
  ADMIN_CHAT_ID: Number(process.env.ADMIN_CHAT_ID || "0"),
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://localhost/telbot",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
};