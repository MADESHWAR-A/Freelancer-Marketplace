const { query } = require("../config/db");

async function updateProfile(req, res) {
  const { skills, hourly_rate, bio, portfolio_url, company_name } = req.body || {};
  const rate = Number(hourly_rate ?? 0);
  if (!Number.isFinite(rate) || rate < 0) return res.status(400).json({ error: "Invalid hourly rate" });

  await query(`
    UPDATE users
    SET skills = ?, hourly_rate = ?, bio = ?, portfolio_url = ?, company_name = ?
    WHERE id = ?
  `, [
    String(skills || "").replace(/[<>]/g, "").slice(0, 1000),
    rate,
    String(bio || "").replace(/[<>]/g, "").slice(0, 5000),
    String(portfolio_url || "").trim().slice(0, 500),
    String(company_name || "").replace(/[<>]/g, "").slice(0, 160),
    req.user.id
  ]);

  const result = await query("SELECT id,name,email,role,company_name,bio,skills,hourly_rate,portfolio_url FROM users WHERE id = ?", [req.user.id]);
  res.json({ user: result.rows[0] });
}

async function findUser(req, res) {
  const result = await query("SELECT id,name,email,role,company_name,bio,skills,hourly_rate,portfolio_url FROM users WHERE id = ?", [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: "User not found" });
  res.json({ user: result.rows[0] });
}

module.exports = { updateProfile, findUser };
