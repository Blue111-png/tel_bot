// Customer support bot — main entry point (JavaScript / node-telegram-bot-api)
// Now backed by a real Postgres database instead of a JSON file.
//
// Key change from the JSON version: every db.* call is now async, so every
// handler that touches the database has to be `async` and use `await`.
// We've also added db.logMessage() calls, so conversation text is actually
// saved now — the gap we found earlier.

const { TelegramBot } = require("node-telegram-bot-api");
const db = require("./db");
const faq = require("./faq");
const { BOT_TOKEN, ADMIN_CHAT_ID } = require("./config");

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Per-chat conversation state, kept in memory — this part is unchanged,
// it's ephemeral UI state, not data that needs to survive a restart.
const userState = {};

function getState(chatId) {
  if (!userState[chatId]) {
    userState[chatId] = { awaitingOrderId: false, inHumanChatTicketId: null };
  }
  return userState[chatId];
}

function mainMenuKeyboard() {
  return {
    reply_markup: {
     inline_keyboard: [
        [{ text: "What can you do?", callback_data: "menu_about" }],
        [{ text: "Available products", callback_data: "menu_products" }],
        [{ text: "Frequently asked questions", callback_data: "menu_faq" }],
        [{ text: "Track my order", callback_data: "menu_track" }],
        [{ text: "Talk to a human", callback_data: "menu_human" }],
      ],
    },
  };
}

// ---------------------------------------------------------------- /start ---
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  userState[chatId] = { awaitingOrderId: false, inHumanChatTicketId: null };
  bot.sendMessage(chatId, "Hi! I'm the support bot. What can I help you with?", mainMenuKeyboard());
});

// ------------------------------------------------------------- menu taps ---
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const state = getState(chatId);

  await bot.answerCallbackQuery(query.id);
  
if (query.data === "menu_about") {
    bot.sendMessage(
      chatId,
      "I'm the support bot for our store! I can:\n\n" +
        "• Answer common questions (shipping, refunds, warranty, etc.)\n" +
        "• Look up the status of an order\n" +
        "• Show you our available products with photos\n" +
        "• Connect you with a real support agent if I can't help\n\n" +
        "Just tap a button below or type your question anytime."
    );
  } else if (query.data === "menu_products") {
    const products = await db.getAllProducts();
    if (!products.length) {
      bot.sendMessage(chatId, "No products available right now.");
    } else {
      for (const p of products) {
        await bot.sendPhoto(chatId, p.image_url, {
          caption: `${p.name} — ${p.price}\n${p.description}`,
        });
      }
    }
  } else if (query.data === "menu_faq") {
    bot.sendMessage(
      chatId,
      `I can help with: ${faq.listTopics()}.\n\n` +
        `Just type your question, for example: "how long does shipping take?"`
    );
  } else if (query.data === "menu_track") {
    state.awaitingOrderId = true;
    bot.sendMessage(chatId, "Sure — what's your order number? (e.g. 1001)");
  } else if (query.data === "menu_human") {
    let ticketId = await db.getOpenTicketForChat(chatId);
    if (ticketId === null) {
      const name = query.message.chat.first_name || "Customer";
      ticketId = await db.createTicket(chatId, name);
      bot.sendMessage(
        ADMIN_CHAT_ID,
        `New support ticket #${ticketId} from ${name}.\nReply with: /reply ${ticketId} <your message>`
      );
    }
    state.inHumanChatTicketId = ticketId;
    bot.sendMessage(
      chatId,
      `You're connected to support (ticket #${ticketId}). Type your message and an agent will reply here shortly.`
    );
  }
});

// ------------------------------------------------------------ free text ---
bot.on("message", async (msg) => {
  const text = msg.text;
  if (!text || text.startsWith("/")) return;

  const chatId = msg.chat.id;
  const state = getState(chatId);

  // 1) Are we waiting for an order id?
  if (state.awaitingOrderId) {
    state.awaitingOrderId = false;
    const order = await db.findOrder(text.trim());
    if (order) {
      bot.sendMessage(
        chatId,
        `Order #${order.order_id} — ${order.item}\nStatus: ${order.status}\nEstimated arrival: ${order.eta}`
      );
    } else {
      bot.sendMessage(
        chatId,
        `I couldn't find an order with number "${text.trim()}". Double check the number, or tap Talk to a human below.`,
        mainMenuKeyboard()
      );
    }
    return;
  }

  // 2) Are we mid-conversation with a human agent?
  if (state.inHumanChatTicketId) {
    const name = msg.chat.first_name || "Customer";
    await db.logMessage(state.inHumanChatTicketId, "customer", text); // NEW: actually saved now
    bot.sendMessage(ADMIN_CHAT_ID, `[Ticket #${state.inHumanChatTicketId}] ${name}: ${text}`);
    bot.sendMessage(chatId, "Sent to the support agent.");
    return;
  }

  // 3) Otherwise, try the FAQ.
  const answer = faq.matchFaq(text);
  if (answer) {
    bot.sendMessage(chatId, answer);
  } else {
    bot.sendMessage(
      chatId,
      "I'm not sure about that one. Choose an option below, or ask in different words.",
      mainMenuKeyboard()
    );
  }
});

// ------------------------------------------------- agent-side: /reply ---
bot.onText(/\/reply (\d+) (.+)/, async (msg, match) => {
  if (msg.chat.id !== ADMIN_CHAT_ID) return;

  const ticketId = Number(match[1]);
  const replyText = match[2];
  const ticket = await db.getTicket(ticketId);
  if (!ticket) {
    bot.sendMessage(msg.chat.id, "No ticket with that id.");
    return;
  }
  await db.logMessage(ticketId, "agent", replyText); // NEW: actually saved now
  bot.sendMessage(ticket.customer_chat_id, `Support agent: ${replyText}`);
  bot.sendMessage(msg.chat.id, "Sent.");
});

// ------------------------------------------------- agent-side: /close ---
bot.onText(/\/close (\d+)/, async (msg, match) => {
  if (msg.chat.id !== ADMIN_CHAT_ID) return;
  const ticketId = Number(match[1]);
  await db.closeTicket(ticketId);
  bot.sendMessage(msg.chat.id, `Ticket #${ticketId} closed.`);
});

// NEW — agent-side: /history <ticket_id>, to prove messages are really saved
bot.onText(/\/history (\d+)/, async (msg, match) => {
  if (msg.chat.id !== ADMIN_CHAT_ID) return;
  const ticketId = Number(match[1]);
  const messages = await db.getMessagesForTicket(ticketId);
  if (!messages.length) {
    bot.sendMessage(msg.chat.id, "No messages logged for that ticket.");
    return;
  }
  const text = messages.map(m => `[${m.sender}] ${m.body}`).join("\n");
  bot.sendMessage(msg.chat.id, `History for ticket #${ticketId}:\n${text}`);
});

db.initDb()
  .then(() => console.log("Database ready. Bot starting (polling)..."))
  .catch((err) => {
    console.error("Failed to initialize database:", err.message);
    process.exit(1);
  });