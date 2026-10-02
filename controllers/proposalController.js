const { query, transaction } = require("../config/db");

async function createProposal(req, res) {
  const { project_id, bid_amount, delivery_days, cover_letter } = req.body || {};
  const bid = Number(bid_amount);
  const days = Number(delivery_days);

  if (!Number.isFinite(bid) || bid <= 0 || !Number.isInteger(days) || days <= 0 || !cover_letter?.trim()) {
    return res.status(400).json({ error: "Valid bid amount, delivery days and cover letter are required" });
  }

  const project = await query("SELECT id,status FROM projects WHERE id = ?", [project_id]);
  if (!project.rows.length || project.rows[0].status !== "open") {
    return res.status(404).json({ error: "Project is not available for proposals" });
  }

  try {
    const result = await query(
      "INSERT INTO proposals (project_id,freelancer_id,bid_amount,delivery_days,cover_letter) VALUES (?,?,?,?,?)",
      [project_id, req.user.id, bid, days, String(cover_letter).replace(/[<>]/g, "").trim().slice(0, 5000)]
    );
    res.status(201).json({ message: "Proposal submitted successfully", id: result.lastID });
  } catch (err) {
    if (String(err.message).toLowerCase().includes("unique")) {
      return res.status(409).json({ error: "You already submitted a proposal for this project" });
    }
    throw err;
  }
}

async function myBids(req, res) {
  const result = await query(`
    SELECT pr.*, p.title AS project_title, p.budget, p.status AS project_status,
           u.name AS client_name
    FROM proposals pr
    JOIN projects p ON p.id = pr.project_id
    JOIN users u ON u.id = p.client_id
    WHERE pr.freelancer_id = ?
    ORDER BY pr.created_at DESC
  `, [req.user.id]);
  res.json({ proposals: result.rows });
}

async function updateProposalStatus(req, res) {
  const status = req.body?.status;
  if (!["accepted", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Invalid proposal status" });
  }

  const result = await query(`
    SELECT pr.id, pr.project_id
    FROM proposals pr
    JOIN projects p ON p.id = pr.project_id
    WHERE pr.id = ? AND p.client_id = ?
  `, [req.params.id, req.user.id]);

  if (!result.rows.length) return res.status(404).json({ error: "Proposal not found" });

  await transaction(async ({ query: tx }) => {
    await tx("UPDATE proposals SET status = ? WHERE id = ?", [status, req.params.id]);
    if (status === "accepted") {
      await tx("UPDATE projects SET status = 'in_progress' WHERE id = ?", [result.rows[0].project_id]);
      await tx(
        "UPDATE proposals SET status = 'rejected' WHERE project_id = ? AND id <> ? AND status = 'pending'",
        [result.rows[0].project_id, req.params.id]
      );
    }
  });

  res.json({ message: `Proposal ${status}` });
}

module.exports = { createProposal, myBids, updateProposalStatus };
