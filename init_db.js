import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const db = new sqlite3.Database(path.join(__dirname, 'vaayun.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS medicines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sub_category TEXT,
    product_name TEXT,
    salt_composition TEXT,
    product_price TEXT,
    product_manufactured TEXT,
    medicine_desc TEXT,
    side_effects TEXT,
    drug_interactions TEXT,
    image_url TEXT,
    category TEXT
  )`);
  db.run('CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, items TEXT, total REAL, status TEXT, drone_id TEXT, delivery_location TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS support_tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, name TEXT, message TEXT, status TEXT DEFAULT "open", timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS support_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER, email TEXT, sender TEXT, message TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(ticket_id) REFERENCES support_tickets(id))');
  db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, phone TEXT, email TEXT UNIQUE, address TEXT, lat REAL, lng REAL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS user_addresses (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, type TEXT, address TEXT, lat REAL, lng REAL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  
  console.log("Database schema initialized.");
  db.close();
});
