const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { query } = require("../config/db");

const publicUser = row => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  company_name: row.company_name,
  bio: row.bio,
  skills: row.skills,
  hourly_rate: row.hourly_rate,
  portfolio_url: row.portfolio_url
});

function setAuthCookie(res, user) {
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );

  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true",
    maxAge: 24 * 60 * 60 * 1000,
    path: "/"
  });
}

async function register(req, res) {
  const body = req.body || {};
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const role = String(body.role || "").trim().toLowerCase();
  const company_name = body.company_name;

  if (name.length < 2) return res.status(400).json({ error: "Full name must contain at least 2 characters" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address" });
}
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
  if (!["client", "freelancer"].includes(role)) return res.status(400).json({ error: "Select Client or Freelancer" });

  const existing = await query("SELECT id FROM users WHERE email = ?", [email]);
  if (existing.rows.length) return res.status(409).json({ error: "Email is already registered" });

  const hash = await bcrypt.hash(password, 10);
  let result;
  try {
    result = await query(
      "INSERT INTO users (name,email,password,role,company_name) VALUES (?,?,?,?,?)",
      [name, email, hash, role, company_name ? String(company_name).slice(0, 160) : null]
    );
  } catch (err) {
    if (String(err.message).toLowerCase().includes("unique")) {
      return res.status(409).json({ error: "Email is already registered" });
    }
    throw err;
  }

  const id = result.lastID || result.rows?.[0]?.id;
  const userResult = await query("SELECT id,name,email,role,company_name,bio,skills,hourly_rate,portfolio_url FROM users WHERE id = ?", [id]);
  const user = userResult.rows[0];
  setAuthCookie(res, user);
  res.status(201).json({ user: publicUser(user) });
}

async function login(req, res) {
  const body = req.body || {};
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const role = String(body.role || "").trim().toLowerCase();
  if (!email || !password || !["client", "freelancer"].includes(role)) {
    return res.status(400).json({ error: "Email, password and role are required" });
  }

  const result = await query("SELECT * FROM users WHERE email = ?", [String(email).trim().toLowerCase()]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(String(password), user.password)) || user.role !== role) {
    return res.status(401).json({ error: "Invalid login credentials or role" });
  }

  setAuthCookie(res, user);
  res.json({ user: publicUser(user) });
}

async function me(req, res) {
  const result = await query(
    "SELECT id,name,email,role,company_name,bio,skills,hourly_rate,portfolio_url,created_at FROM users WHERE id = ?",
    [req.user.id]
  );
  if (!result.rows.length) return res.status(401).json({ error: "Session user no longer exists" });
  res.json({ user: result.rows[0] });
}

function logout(req, res) {
  res.clearCookie("token", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true", path: "/" });
  res.json({ message: "Logged out successfully" });
}

module.exports = { register, login, me, logout };
