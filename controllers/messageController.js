const { query } = require("../config/db");

async function history(req, res) {
  const otherId = Number(req.params.otherUserId);
  if (!Number.isInteger(otherId) || otherId <= 0) return res.status(400).json({ error: "Invalid user id" });

  const otherUser = await query("SELECT id,name,role FROM users WHERE id = ?", [otherId]);
  if (!otherUser.rows.length) return res.status(404).json({ error: "Chat user not found" });

  const result = await query(`
    SELECT id,sender_id,receiver_id,content,created_at
    FROM messages
    WHERE (sender_id = ? AND receiver_id = ?)
       OR (sender_id = ? AND receiver_id = ?)
    ORDER BY created_at ASC
  `, [req.user.id, otherId, otherId, req.user.id]);

  res.json({ user: otherUser.rows[0], messages: result.rows });
}

module.exports = { history };
