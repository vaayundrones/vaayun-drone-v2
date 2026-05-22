import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const port = 3001;
const db = new sqlite3.Database('./vaayun.db');

// --- MONGODB SETUP ---
import mongoose from 'mongoose';
const MONGO_URI = 'mongodb+srv://yuvansiddi14_db_user:XuNffF7Mw3ddJFNB@cluster0.kd5yxp9.mongodb.net/vaayun?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- MONGOOSE SCHEMAS ---
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
  items: String,
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

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// --- GMAIL SETUP ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'yuvan.siddi09@gmail.com',
    pass: 'xxdr uyew jkag vknr'
  }
});

// --- FLEET STATE ---
let fleetDrones = [
  { id: 'VX-99', status: 'OFFLINE', battery: 0, speed: 0, alt: 0, heading: 0, mode: 'STANDBY', armed: false, ip: null, isLive: false },
  { id: 'VX-102', status: 'STANDBY', battery: 100, speed: 0, alt: 0, heading: 0, mode: 'IDLE', armed: false },
  { id: 'VX-105', status: 'CHARGING', battery: 32, speed: 0, alt: 0, heading: 0, mode: 'IDLE', armed: false },
  { id: 'VX-108', status: 'STANDBY', battery: 98, speed: 0, alt: 0, heading: 0, mode: 'IDLE', armed: false },
  { id: 'VX-112', status: 'MAINTENANCE', battery: 15, speed: 0, alt: 0, heading: 0, mode: 'IDLE', armed: false },
  { id: 'VX-114', status: 'STANDBY', battery: 100, speed: 0, alt: 0, heading: 0, mode: 'IDLE', armed: false }
];

const vendors = [
  { id: 'V1', name: 'Apollo Pharmacy', distance: '1.2km', inventory: 85, activeOrders: 2 },
  { id: 'V2', name: 'MedPlus Store', distance: '3.5km', inventory: 92, activeOrders: 0 },
  { id: 'V3', name: 'Fortis Medicals', distance: '5.8km', inventory: 78, activeOrders: 1 }
];

// --- MEDICINE SEARCH ---
app.get('/api/medicines/search', (req, res) => {
  const { q, category } = req.query;
  let sql = "SELECT * FROM medicines WHERE 1=1";
  let params = [];
  if (q) {
    const terms = q.split(' ').filter(t => t.trim() !== '');
    terms.forEach(term => {
      sql += " AND (product_name LIKE ? OR salt_composition LIKE ? OR sub_category LIKE ?)";
      params.push(`%${term}%`, `%${term}%`, `%${term}%`);
    });
  }
  if (category && category !== 'all') {
    sql += " AND sub_category = ?";
    params.push(category);
  }
  sql += " LIMIT 50";
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/medicines', (req, res) => {
  db.all("SELECT * FROM medicines LIMIT 100", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// --- AUTH ROUTES (REAL GMAIL OTP) ---
let otpStorage = {};

app.post('/api/send-otp', (req, res) => {
  const { email, isLoginFlow } = req.body;
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  otpStorage[email] = otp;
  const mailOptions = {
    from: 'yuvan.siddi09@gmail.com',
    to: email,
    subject: 'Your Vaayun Verification Code',
    text: `Your verification code is: ${otp}. It is valid for 10 minutes.`
  };
  if (isLoginFlow) {
    User.findOne({ email }).then(user => {
      if (!user) return res.status(404).json({ error: "User not found. Please Sign Up." });
      transporter.sendMail(mailOptions, (error) => {
        if (error) return res.status(500).json({ error: "Failed to send email." });
        res.json({ message: "OTP sent to your Gmail!" });
      });
    }).catch(err => res.status(500).json({ error: err.message }));
  } else {
    transporter.sendMail(mailOptions, (error) => {
      if (error) return res.status(500).json({ error: "Failed to send email." });
      res.json({ message: "Verification code sent to your Gmail!" });
    });
  }
});

app.post('/api/verify-otp', (req, res) => {
  const { email, otp, userData, isLoginFlow } = req.body;
  if (otpStorage[email] !== otp) {
    return res.status(400).json({ error: "Invalid OTP. Check your Gmail." });
  }
  delete otpStorage[email];
  if (isLoginFlow) {
    User.findOne({ email })
      .then(user => res.json({ user }))
      .catch(err => res.status(500).json({ error: err.message }));
  } else {
    const { name, phone, email: userEmail, address, lat, lng } = userData;
    User.create({ name, phone, email: userEmail, address, lat, lng })
      .then(user => res.json({ user }))
      .catch(err => res.status(500).json({ error: err.message }));
  }
});

// --- USER ADDRESSES ---
app.post('/api/user/addresses', (req, res) => {
  const { email, type, address, lat, lng } = req.body;
  UserAddress.create({ email, type, address, lat, lng })
    .then(doc => res.json({ success: true, id: doc._id }))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.get('/api/user/addresses/:email', (req, res) => {
  UserAddress.find({ email: req.params.email })
    .then(rows => res.json(rows))
    .catch(err => res.status(500).json({ error: err.message }));
});

// --- ORDERS & SUPPORT ---
app.get('/api/orders', (req, res) => {
  Order.find().sort({ created_at: -1 })
    .then(rows => res.json(rows.map(r => ({...r.toObject(), id: r._id}))))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.get('/api/orders/:id', (req, res) => {
  Order.findById(req.params.id)
    .then(row => res.json(row ? {...row.toObject(), id: row._id} : null))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.get('/api/user/orders/:email', (req, res) => {
  Order.find({ user_email: req.params.email }).sort({ created_at: -1 })
    .then(rows => res.json(rows.map(r => ({...r.toObject(), id: r._id}))))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.get('/api/admin/drones', (req, res) => res.json(fleetDrones));

app.post('/api/orders', (req, res) => {
  const { email, name, lat, lng, items } = req.body;
  const itemsStr = JSON.stringify(items);
  Order.create({ user_email: email, user_name: name, status: 'PENDING', lat, lng, items: itemsStr })
    .then(order => {
      io.emit('new-order', { id: order._id, user_name: name, status: 'PENDING' });
      res.json({ success: true, orderId: order._id });
    })
    .catch(err => res.status(500).json({ error: err.message }));
});

app.post('/api/assign-drone', (req, res) => {
  const { orderId, droneId } = req.body;
  Order.findByIdAndUpdate(orderId, { status: 'DISPATCHED', drone_id: droneId }, { new: true })
    .then(order => {
      if (!order) return res.status(404).json({ error: "Order not found" });
      const drone = fleetDrones.find(d => d.id === droneId);
      if (drone) {
        drone.status = 'ACTIVE';
        drone.delivery = { lat: order.lat, lng: order.lng };
      }
      io.emit('order-assigned', { orderId, droneId, drone });
      res.json({ success: true });
    })
    .catch(err => res.status(500).json({ error: err.message }));
});

app.post('/api/orders/:id/deliver', (req, res) => {
  const orderId = req.params.id;
  Order.findByIdAndUpdate(orderId, { status: 'DELIVERED' })
    .then(order => {
      if (!order) return res.status(404).json({ error: "Order not found" });
      const droneId = order.drone_id;
      if (droneId) {
        const drone = fleetDrones.find(d => d.id === droneId);
        if (drone) drone.status = 'STANDBY';
      }
      io.emit('order-delivered', { id: orderId, droneId });
      res.json({ success: true });
    })
    .catch(err => res.status(500).json({ error: err.message }));
});

app.get('/api/support/tickets', (req, res) => {
  SupportTicket.find()
    .then(rows => res.json(rows))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.get('/api/support/chat/:email', (req, res) => {
  SupportMessage.find({ email: req.params.email }).sort({ timestamp: 1 })
    .then(messages => {
      const hasAdmin = messages.some(m => m.sender === 'admin');
      res.json({ messages, status: hasAdmin ? 'human' : 'ai' });
    })
    .catch(err => res.status(500).json({ error: err.message }));
});

app.post('/api/support/chat', async (req, res) => {
  try {
    const { email, name, message, sender } = req.body;
    if (sender === 'user') {
      let ticket = await SupportTicket.findOne({ email });
      if (!ticket) {
        ticket = await SupportTicket.create({ email, name, status: 'ai' });
      }
      const isHuman = ticket.status === 'human';
      await SupportMessage.create({ email, sender, message });
      
      if (!isHuman) {
        let aiResponse = "I've received your message. A Vaayun agent will be with you shortly.";
        const msg = message.toLowerCase();
        if (msg.includes('order')) aiResponse = "You can track your active orders in the 'SkyNet HUD' or check 'Recent Orders' in your account.";
        if (msg.includes('drone')) aiResponse = "Our drones are VX-series high-performance delivery units. They are fully autonomous and safe.";
        if (msg.includes('medic')) aiResponse = "We have 250,000+ medicines in our database. Search for yours in the home screen!";
        setTimeout(async () => {
          await SupportMessage.create({ email, sender: 'ai', message: aiResponse });
          io.emit('new-message', { email, sender: 'ai', message: aiResponse });
        }, 1500);
      }
      io.emit('new-message', { email, sender, message });
      res.json({ success: true });
    } else {
      await SupportMessage.create({ email, sender, message });
      io.emit('new-message', { email, sender, message });
      res.json({ success: true });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/support/send-message', async (req, res) => {
  try {
    const { email, sender, message } = req.body;
    await SupportTicket.updateOne({ email }, { status: 'human' });
    await SupportMessage.create({ email, sender, message });
    io.emit('new-message', { email, sender, message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/support/chat/:email', async (req, res) => {
  try {
    const email = req.params.email;
    await SupportTicket.deleteOne({ email });
    const endMessage = "Support session has been officially closed by the agent.";
    await SupportMessage.create({ email, sender: 'system', message: endMessage });
    io.emit('chat-ended', { email });
    io.emit('new-message', { email, sender: 'system', message: endMessage });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- FLEET API ---
app.get('/api/drones', (req, res) => res.json(fleetDrones));
app.get('/api/vendors', (req, res) => res.json(vendors));

// --- SOCKET.IO ---
io.on('connection', (socket) => {
  const clientIp = socket.handshake.address.replace('::ffff:', '');

  socket.on('register_drone', (data) => {
    const update = { ...data, ip: clientIp, isLive: true, status: 'ACTIVE' };
    updateDroneState(update);
    io.emit('telemetry-update', update);
  });

  socket.on('telemetry_position', (data) => {
    const update = { id: data.id, lat: data.lat, lng: data.lng, alt: data.alt_rel, alt_abs: data.alt_abs };
    updateDroneState(update);
    io.emit('telemetry-update', update);
  });

  socket.on('telemetry_heading', (data) => {
    const update = { id: data.id, heading: data.heading };
    updateDroneState(update);
    io.emit('telemetry-update', update);
  });

  socket.on('telemetry_velocity', (data) => {
    const update = { id: data.id, speed: parseFloat((data.ground_speed_ms * 3.6).toFixed(1)), vertical_speed: data.vertical_speed_ms };
    updateDroneState(update);
    io.emit('telemetry-update', update);
  });

  socket.on('telemetry_attitude', (data) => {
    const update = { id: data.id, roll: data.roll, pitch: data.pitch, yaw: data.yaw };
    updateDroneState(update);
    io.emit('telemetry-update', update);
  });

  socket.on('telemetry_battery', (data) => {
    const update = { id: data.id, battery: data.percent, voltage: data.voltage };
    updateDroneState(update);
    io.emit('telemetry-update', update);
  });

  socket.on('telemetry_gps', (data) => {
    const update = { id: data.id, num_sats: data.num_sats, fix_type: data.fix_type };
    updateDroneState(update);
    io.emit('telemetry-update', update);
  });

  socket.on('telemetry_mode', (data) => {
    const update = { id: data.id, mode: data.mode };
    updateDroneState(update);
    io.emit('telemetry-update', update);
  });

  socket.on('telemetry_armed', (data) => {
    const update = { id: data.id, armed: data.armed };
    updateDroneState(update);
    io.emit('telemetry-update', update);
  });

  socket.on('telemetry_rc', (data) => {
    const update = { id: data.id, rc_available: data.available, rc_signal: data.signal_strength };
    updateDroneState(update);
    io.emit('telemetry-update', update);
  });

  socket.on('drone-telemetry', (data) => {
    const update = { ...data, ip: clientIp };
    updateDroneState(update);
    io.emit('telemetry-update', update);
  });
});

function updateDroneState(data) {
  const drone = fleetDrones.find(d => d.id === data.id);
  if (drone) Object.keys(data).forEach(key => { if (data[key] != null) drone[key] = data[key]; });
}

// --- FALLBACK ROUTES FOR SPA ---
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'admin.html'));
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

httpServer.listen(port, '0.0.0.0', () => {
  const ip = Object.values(os.networkInterfaces()).flat().find(i => i.family === 'IPv4' && !i.internal)?.address || 'localhost';
  console.log(`🚀 Vaayun Backend FULLY RESTORED on http://${ip}:${port}`);
});