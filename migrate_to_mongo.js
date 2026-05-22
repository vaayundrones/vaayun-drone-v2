import sqlite3 from 'sqlite3';
import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://yuvansiddi14_db_user:XuNffF7Mw3ddJFNB@cluster0.kd5yxp9.mongodb.net/vaayun?retryWrites=true&w=majority&appName=Cluster0';

// Mongoose Schemas
const userSchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: { type: String, unique: true },
  address: String,
  lat: Number,
  lng: Number,
  created_at: { type: Date, default: Date.now }
});

const addressSchema = new mongoose.Schema({
  email: String,
  type: String,
  address: String,
  lat: Number,
  lng: Number
});

const orderSchema = new mongoose.Schema({
  user_email: String,
  user_name: String,
  status: { type: String, default: 'PENDING' },
  lat: Number,
  lng: Number,
  items: String, // Stringified JSON to match SQLite structure initially, or we could parse it
  drone_id: String,
  created_at: { type: Date, default: Date.now }
});

const ticketSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  name: String,
  status: { type: String, default: 'ai' }
});

const messageSchema = new mongoose.Schema({
  email: String,
  sender: String,
  message: String,
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const UserAddress = mongoose.model('UserAddress', addressSchema);
const Order = mongoose.model('Order', orderSchema);
const SupportTicket = mongoose.model('SupportTicket', ticketSchema);
const SupportMessage = mongoose.model('SupportMessage', messageSchema);

const db = new sqlite3.Database('./vaayun.db');

async function migrateData() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB Atlas.");

    // Helper to fetch SQLite data
    const fetchAll = (query) => new Promise((resolve, reject) => {
      db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    console.log("Migrating Users...");
    const users = await fetchAll("SELECT * FROM users");
    for (let u of users) {
      await User.findOneAndUpdate({ email: u.email }, {
        name: u.name, phone: u.phone, address: u.address, lat: u.lat, lng: u.lng, created_at: u.created_at
      }, { upsert: true });
    }
    console.log(`✅ Migrated ${users.length} Users.`);

    console.log("Migrating Addresses...");
    const addresses = await fetchAll("SELECT * FROM user_addresses");
    await UserAddress.deleteMany({});
    for (let a of addresses) {
      await UserAddress.create({ email: a.email, type: a.type, address: a.address, lat: a.lat, lng: a.lng });
    }
    console.log(`✅ Migrated ${addresses.length} Addresses.`);

    console.log("Migrating Orders...");
    const orders = await fetchAll("SELECT * FROM orders");
    await Order.deleteMany({});
    for (let o of orders) {
      await Order.create({
        user_email: o.user_email, user_name: o.user_name, status: o.status,
        lat: o.lat, lng: o.lng, items: o.items, drone_id: o.drone_id, created_at: o.created_at
      });
    }
    console.log(`✅ Migrated ${orders.length} Orders.`);

    console.log("Migrating Support Tickets...");
    const tickets = await fetchAll("SELECT * FROM support_tickets");
    for (let t of tickets) {
      await SupportTicket.findOneAndUpdate({ email: t.email }, {
        name: t.name, status: t.status
      }, { upsert: true });
    }
    console.log(`✅ Migrated ${tickets.length} Tickets.`);

    console.log("Migrating Support Messages...");
    const messages = await fetchAll("SELECT * FROM support_messages");
    await SupportMessage.deleteMany({});
    for (let m of messages) {
      await SupportMessage.create({
        email: m.email, sender: m.sender, message: m.message, timestamp: m.timestamp
      });
    }
    console.log(`✅ Migrated ${messages.length} Messages.`);

    console.log("🎉 Dynamic Data Migration Complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration Error:", error);
    process.exit(1);
  }
}

migrateData();
