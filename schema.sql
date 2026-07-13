-- Run once to set up the database structure.
-- Compared to the JSON file, this adds a `messages` table — the actual
-- gap we found earlier, where conversation text was never being saved.

CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    customer_chat_id BIGINT NOT NULL,
    customer_name TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id),
    sender TEXT NOT NULL,       -- 'customer' or 'agent'
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
    order_id TEXT PRIMARY KEY,
    item TEXT NOT NULL,
    status TEXT NOT NULL,
    eta TEXT
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price TEXT,
    image_url TEXT NOT NULL
);