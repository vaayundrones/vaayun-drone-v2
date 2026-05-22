import fs from 'fs';

let content = fs.readFileSync('server.js', 'utf8');

// Replace send-otp user check
content = content.replace(
  `db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(404).json({ error: "User not found. Please Sign Up." });
      transporter.sendMail(mailOptions, (error) => {
        if (error) return res.status(500).json({ error: "Failed to send email." });
        res.json({ message: "OTP sent to your Gmail!" });
      });
    });`,
  `User.findOne({ email }).then(user => {
      if (!user) return res.status(404).json({ error: "User not found. Please Sign Up." });
      transporter.sendMail(mailOptions, (error) => {
        if (error) return res.status(500).json({ error: "Failed to send email." });
        res.json({ message: "OTP sent to your Gmail!" });
      });
    }).catch(err => res.status(500).json({ error: err.message }));`
);

// Replace verify-otp logic
content = content.replace(
  `  if (isLoginFlow) {
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ user });
    });
  } else {
    const { name, phone, email: userEmail, address, lat, lng } = userData;
    db.run(
      "INSERT INTO users (name, phone, email, address, lat, lng) VALUES (?, ?, ?, ?, ?, ?)",
      [name, phone, userEmail, address, lat, lng],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        db.get("SELECT * FROM users WHERE id = ?", [this.lastID], (err, user) => {
          res.json({ user });
        });
      }
    );
  }`,
  `  if (isLoginFlow) {
    User.findOne({ email })
      .then(user => res.json({ user }))
      .catch(err => res.status(500).json({ error: err.message }));
  } else {
    const { name, phone, email: userEmail, address, lat, lng } = userData;
    User.create({ name, phone, email: userEmail, address, lat, lng })
      .then(user => res.json({ user }))
      .catch(err => res.status(500).json({ error: err.message }));
  }`
);

// Replace user addresses
content = content.replace(
  `app.post('/api/user/addresses', (req, res) => {
  const { email, type, address, lat, lng } = req.body;
  db.run("INSERT INTO user_addresses (email, type, address, lat, lng) VALUES (?, ?, ?, ?, ?)", [email, type, address, lat, lng], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: this.lastID });
  });
});

app.get('/api/user/addresses/:email', (req, res) => {
  db.all("SELECT * FROM user_addresses WHERE email = ?", [req.params.email], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});`,
  `app.post('/api/user/addresses', (req, res) => {
  const { email, type, address, lat, lng } = req.body;
  UserAddress.create({ email, type, address, lat, lng })
    .then(doc => res.json({ success: true, id: doc._id }))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.get('/api/user/addresses/:email', (req, res) => {
  UserAddress.find({ email: req.params.email })
    .then(rows => res.json(rows))
    .catch(err => res.status(500).json({ error: err.message }));
});`
);

// Replace Orders
content = content.replace(
  `// --- ORDERS & SUPPORT ---
app.get('/api/orders', (req, res) => {
  db.all("SELECT * FROM orders ORDER BY created_at DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/orders/:id', (req, res) => {
  db.get("SELECT * FROM orders WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});

app.get('/api/user/orders/:email', (req, res) => {
  db.all("SELECT * FROM orders WHERE user_email = ? ORDER BY created_at DESC", [req.params.email], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});`,
  `// --- ORDERS & SUPPORT ---
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
});`
);

// Replace create order
content = content.replace(
  `app.post('/api/orders', (req, res) => {
  const { email, name, lat, lng, items } = req.body;
  const itemsStr = JSON.stringify(items);
  db.run(
    "INSERT INTO orders (user_email, user_name, status, lat, lng, items) VALUES (?, ?, 'PENDING', ?, ?, ?)",
    [email, name, lat, lng, itemsStr],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      const orderId = this.lastID;
      io.emit('new-order', { id: orderId, user_name: name, status: 'PENDING' });
      res.json({ success: true, orderId });
    }
  );
});`,
  `app.post('/api/orders', (req, res) => {
  const { email, name, lat, lng, items } = req.body;
  const itemsStr = JSON.stringify(items);
  Order.create({ user_email: email, user_name: name, status: 'PENDING', lat, lng, items: itemsStr })
    .then(order => {
      io.emit('new-order', { id: order._id, user_name: name, status: 'PENDING' });
      res.json({ success: true, orderId: order._id });
    })
    .catch(err => res.status(500).json({ error: err.message }));
});`
);

// Replace assign drone
content = content.replace(
  `app.post('/api/assign-drone', (req, res) => {
  const { orderId, droneId } = req.body;
  db.run("UPDATE orders SET status = 'DISPATCHED', drone_id = ? WHERE id = ?", [droneId, orderId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.get("SELECT lat, lng FROM orders WHERE id = ?", [orderId], (err2, order) => {
      const drone = fleetDrones.find(d => d.id === droneId);
      if (drone) {
        drone.status = 'ACTIVE';
        if (order) drone.delivery = { lat: order.lat, lng: order.lng };
      }
      io.emit('order-assigned', { orderId, droneId, drone });
      res.json({ success: true });
    });
  });
});`,
  `app.post('/api/assign-drone', (req, res) => {
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
});`
);

// Replace deliver order
content = content.replace(
  `app.post('/api/orders/:id/deliver', (req, res) => {
  const orderId = req.params.id;
  db.get("SELECT drone_id FROM orders WHERE id = ?", [orderId], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: "Order not found" });
    db.run("UPDATE orders SET status = 'DELIVERED' WHERE id = ?", [orderId], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      const droneId = order.drone_id;
      if (droneId) {
        const drone = fleetDrones.find(d => d.id === droneId);
        if (drone) drone.status = 'STANDBY';
      }
      io.emit('order-delivered', { id: orderId, droneId });
      res.json({ success: true });
    });
  });
});`,
  `app.post('/api/orders/:id/deliver', (req, res) => {
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
});`
);

// Replace support routes
content = content.replace(
  `app.get('/api/support/tickets', (req, res) => {
  db.all("SELECT * FROM support_tickets", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/support/chat/:email', (req, res) => {
  db.all("SELECT * FROM support_messages WHERE email = ? ORDER BY timestamp ASC", [req.params.email], (err, messages) => {
    if (err) return res.status(500).json({ error: err.message });
    const hasAdmin = messages.some(m => m.sender === 'admin');
    res.json({ messages, status: hasAdmin ? 'human' : 'ai' });
  });
});`,
  `app.get('/api/support/tickets', (req, res) => {
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
});`
);

// Replace support/chat post
content = content.replace(
  `app.post('/api/support/chat', (req, res) => {
  const { email, name, message, sender } = req.body;
  if (sender === 'user') {
    db.run("INSERT OR IGNORE INTO support_tickets (email, name, status) VALUES (?, ?, 'ai')", [email, name], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get("SELECT status FROM support_tickets WHERE email = ?", [email], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        const isHuman = row && row.status === 'human';
        db.run("INSERT INTO support_messages (email, sender, message) VALUES (?, ?, ?)", [email, sender, message], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          if (!isHuman) {
            let aiResponse = "I've received your message. A Vaayun agent will be with you shortly.";
            const msg = message.toLowerCase();
            if (msg.includes('order')) aiResponse = "You can track your active orders in the 'SkyNet HUD' or check 'Recent Orders' in your account.";
            if (msg.includes('drone')) aiResponse = "Our drones are VX-series high-performance delivery units. They are fully autonomous and safe.";
            if (msg.includes('medic')) aiResponse = "We have 250,000+ medicines in our database. Search for yours in the home screen!";
            setTimeout(() => {
              db.run("INSERT INTO support_messages (email, sender, message) VALUES (?, 'ai', ?)", [email, aiResponse]);
              io.emit('new-message', { email, sender: 'ai', message: aiResponse });
            }, 1500);
          }
          io.emit('new-message', { email, sender, message });
          res.json({ success: true });
        });
      });
    });
  } else {
    db.run("INSERT INTO support_messages (email, sender, message) VALUES (?, ?, ?)", [email, sender, message], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      io.emit('new-message', { email, sender, message });
      res.json({ success: true });
    });
  }
});`,
  `app.post('/api/support/chat', async (req, res) => {
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
});`
);

// Replace support/send-message and delete chat
content = content.replace(
  `app.post('/api/support/send-message', (req, res) => {
  const { email, sender, message } = req.body;
  db.run("UPDATE support_tickets SET status = 'human' WHERE email = ?", [email], () => {
    db.run("INSERT INTO support_messages (email, sender, message) VALUES (?, ?, ?)", [email, sender, message], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      io.emit('new-message', { email, sender, message });
      res.json({ success: true });
    });
  });
});

app.delete('/api/support/chat/:email', (req, res) => {
  const email = req.params.email;
  db.run("DELETE FROM support_tickets WHERE email = ?", [email], (err2) => {
    if (err2) return res.status(500).json({ error: err2.message });
    const endMessage = "Support session has been officially closed by the agent.";
    db.run("INSERT INTO support_messages (email, sender, message) VALUES (?, 'system', ?)", [email, endMessage], () => {
      io.emit('chat-ended', { email });
      io.emit('new-message', { email, sender: 'system', message: endMessage });
      res.json({ success: true });
    });
  });
});`,
  `app.post('/api/support/send-message', async (req, res) => {
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
});`
);

fs.writeFileSync('server.js', content);
console.log('Done refactoring server.js!');
