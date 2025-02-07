const express = require("express");
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const mysql = require("mysql2/promise");
const cors = require('cors');
const MySQLStore = require('express-mysql-session')(session); // Tambahkan session store
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000; // Default port untuk development

// Middleware
app.use(cors({
  origin: "https://flotistorchid.vercel.app", // Pastikan tanpa trailing slash
  methods: ["POST", "GET", "PUT", "DELETE"],
  credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Setup session dengan MySQL store
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false
  },
  createDatabaseTable: true // Buat tabel sessions jika belum ada
});

app.use(session({
  secret: process.env.SESSION_SECRET,
  store: sessionStore, // Gunakan MySQL store
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Secure hanya untuk production
    maxAge: 1000 * 60 * 60 * 24 // 1 hari
  }
}));

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  ssl: { rejectUnauthorized: false }, // SSL Wajib untuk Clever Cloud
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Test database connection
pool.getConnection()
  .then(conn => {
    console.log("Database connected successfully!");
    conn.release();
  })
  .catch(err => {
    console.error("Database connection failed:", err.message);
  });


// Serve static files (opsional, jika menggunakan Vercel static hosting)
// app.use(express.static(path.join(__dirname, "public")));

// Root route (opsional, jika menggunakan Vercel static hosting)
// app.get("/", (req, res) => {
//   res.sendFile(path.join(__dirname, "public", "index.html"));
// });

// Register endpoint
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashedPassword]);
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Login endpoint
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const [users] = await pool.query("SELECT * FROM users WHERE username = ?", [username]);
    if (users.length === 0) return res.status(401).json({ error: "Invalid credentials" });

    const user = users[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.status(401).json({ error: "Invalid credentials" });

    req.session.user = { id: user.id, username: user.username };
    res.json({ message: "Login successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Logout endpoint
app.post("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: "Could not log out" });
    res.clearCookie('connect.sid'); // Pastikan sesi dihapus dari cookie
    res.json({ message: "Logout successful" });
  });
});

// Product endpoints
app.get("/products", async (req, res) => {
  try {
    const [results] = await pool.query("SELECT * FROM products");
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/product/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [results] = await pool.query("SELECT * FROM products WHERE id = ?", [id]);
    if (results.length === 0) return res.status(404).json({ error: "Product not found" });
    res.json(results[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/product", async (req, res) => {
  const { name, description, price, image_url } = req.body;
  try {
    const [result] = await pool.query(
      "INSERT INTO products (name, description, price, image_url) VALUES (?, ?, ?, ?)",
      [name, description, price, image_url]
    );
    res.status(201).json({ id: result.insertId, name, description, price, image_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/product/:id", async (req, res) => {
  const { id } = req.params;
  const { name, description, price, image_url } = req.body;
  try {
    const [result] = await pool.query(
      "UPDATE products SET name = ?, description = ?, price = ?, image_url = ? WHERE id = ?",
      [name, description, price, image_url, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Product not found" });
    res.json({ id, name, description, price, image_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.delete("/product/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query("DELETE FROM products WHERE id = ?", [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Product not found" });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Check session endpoint
app.get("/check-session", (req, res) => {
  res.json({ session: req.session });
});

// Contoh endpoint API
app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from Vercel!" });
});

app.get("/test-db", async (req, res) => {
  try {
    const [result] = await pool.query("SELECT NOW() AS time");
    res.json({ message: "Database connected!", time: result[0].time });
  } catch (err) {
    console.error("Database connection error:", err);
    res.status(500).json({ error: err.message });
  }
});


// Start server
// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });

module.exports = app;