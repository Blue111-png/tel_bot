// Real database backend using PostgreSQL, replacing the data.json file.
//
// Two things changed from the JSON-file version:
//   1. Every function is now async — database calls happen over the network,
//      so callers must `await` them (unlike synchronous fs.readFileSync).
//   2. Messages are actually logged now (a gap we found earlier — the old
//      version relayed message text live through Telegram but never saved it).
const { Pool } = require("pg");
const { DATABASE_URL } = require("./config");

const pool = new Pool({ connectionString: DATABASE_URL });

async function initDb() {
  const fs = require("fs");
  const schema = fs.readFileSync(__dirname + "/schema.sql", "utf8");
  await pool.query(schema);

  const { rows } = await pool.query("SELECT COUNT(*) FROM orders");
  if (Number(rows[0].count) === 0) {
    await pool.query(
      `INSERT INTO orders (order_id, item, status, eta) VALUES
       ('1001', 'Wireless headphones', 'Shipped', 'July 15'),
       ('1002', 'Espresso machine', 'Processing', 'July 20'),
       ('1003', 'Desk lamp', 'Delivered', 'Delivered July 8')`
    );
  }


const { rows: productRows } = await pool.query("SELECT COUNT(*) FROM products");
  if (Number(productRows[0].count) === 0) {
    await pool.query(`INSERT INTO products (name, description, price, image_url) VALUES
       ('Wireless Headphones', 'Over-ear, noise cancelling, 30hr battery', '$79.99', 'https://picsum.photos/id/367/500/400'),
       ('Espresso Machine', 'Compact 15-bar pump, milk frother included', '$149.99', 'https://picsum.photos/id/225/500/400'),
       ('Desk Lamp', 'Adjustable LED, 3 brightness levels', '$24.99', 'https://picsum.photos/id/103/500/400')`
    );
  }
}

async function createTicket(chatId, customerName) {
  const { rows } = await pool.query(
    "INSERT INTO tickets (customer_chat_id, customer_name) VALUES ($1, $2) RETURNING id",
    [chatId, customerName]
  );
  return rows[0].id;
}

async function getOpenTicketForChat(chatId) {
  const { rows } = await pool.query(
    "SELECT id FROM tickets WHERE customer_chat_id = $1 AND status = 'open' ORDER BY id DESC LIMIT 1",
    [chatId]
  );
  return rows.length ? rows[0].id : null;
}

async function getTicket(ticketId) {
  const { rows } = await pool.query("SELECT * FROM tickets WHERE id = $1", [ticketId]);
  return rows[0] || null;
}

async function closeTicket(ticketId) {
  await pool.query("UPDATE tickets SET status = 'closed' WHERE id = $1", [ticketId]);
}

async function findOrder(orderId) {
  const { rows } = await pool.query("SELECT * FROM orders WHERE order_id = $1", [orderId]);
  return rows[0] || null;
}

// NEW — actually persist conversation text, which the JSON version never did.
async function logMessage(ticketId, sender, body) {
  await pool.query(
    "INSERT INTO messages (ticket_id, sender, body) VALUES ($1, $2, $3)",
    [ticketId, sender, body]
  );
}

async function getMessagesForTicket(ticketId) {
  const { rows } = await pool.query(
    "SELECT sender, body, created_at FROM messages WHERE ticket_id = $1 ORDER BY id ASC",
    [ticketId]
  );
  return rows;
}

async function getAllProducts() {
  const { rows } = await pool.query("SELECT * FROM products ORDER BY id ASC");
  return rows;
}

module.exports = {
  initDb,
  getAllProducts,
  createTicket,
  getOpenTicketForChat,
  getTicket,
  closeTicket,
  findOrder,
  logMessage,
  getMessagesForTicket,
};