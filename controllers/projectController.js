const { query } = require("../config/db");

async function createProject(req, res) {
  const { title, description, budget, skills_required } = req.body;
  const result = await query(
    "INSERT INTO projects (client_id,title,description,budget,skills_required) VALUES (?,?,?,?,?)",
    [req.user.id, title, description, budget, skills_required]
  );
  const id = result.lastID || result.rows?.[0]?.id;
  const project = await query("SELECT * FROM projects WHERE id = ?", [id]);
  res.status(201).json({ project: project.rows[0] });
}

async function myProjects(req, res) {
  const result = await query(`
    SELECT p.*, COUNT(pr.id) AS proposal_count
    FROM projects p
    LEFT JOIN proposals pr ON pr.project_id = p.id
    WHERE p.client_id = ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `, [req.user.id]);
  res.json({ projects: result.rows });
}

async function proposalsForProject(req, res) {
  const result = await query(`
    SELECT pr.*, u.name AS freelancer_name, u.email AS freelancer_email,
           u.skills, u.hourly_rate, u.bio, u.portfolio_url
    FROM proposals pr
    JOIN projects p ON p.id = pr.project_id
    JOIN users u ON u.id = pr.freelancer_id
    WHERE pr.project_id = ? AND p.client_id = ?
    ORDER BY pr.created_at DESC
  `, [req.params.id, req.user.id]);
  res.json({ proposals: result.rows });
}

async function openProjects(req, res) {
  const result = await query(`
    SELECT p.*, u.name AS client_name, u.company_name,
           (SELECT COUNT(*) FROM proposals pr WHERE pr.project_id = p.id) AS proposal_count
    FROM projects p
    JOIN users u ON u.id = p.client_id
    WHERE p.status = 'open'
    ORDER BY p.created_at DESC
  `);
  res.json({ projects: result.rows });
}

module.exports = { createProject, myProjects, proposalsForProject, openProjects };
