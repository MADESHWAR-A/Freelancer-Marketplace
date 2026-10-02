const bcrypt = require("bcrypt");
const { query } = require("./db");

const DEMO = {
  client: {
    name: "Workly Demo Client",
    email: "client@workly.demo",
    password: "Client@12345",
    role: "client",
    company_name: "Nova Digital Labs",
    bio: "Demo client account for reviewing the Workly marketplace.",
    portfolio_url: "https://example.com/client"
  },
  freelancer: {
    name: "Workly Demo Freelancer",
    email: "freelancer@workly.demo",
    password: "Freelancer@12345",
    role: "freelancer",
    company_name: "PixelForge Studio",
    bio: "Full-stack developer specializing in Node.js, SQL and UI/UX.",
    skills: "Node.js, Express, JavaScript, SQL, UI/UX",
    hourly_rate: 35,
    portfolio_url: "https://example.com/freelancer"
  }
};

async function ensureUser(account) {
  const existing = await query("SELECT id FROM users WHERE email = ?", [account.email]);
  if (existing.rows.length) return existing.rows[0].id;

  const hash = await bcrypt.hash(account.password, 10);
  const result = await query(
    `INSERT INTO users (name,email,password,role,company_name,bio,skills,hourly_rate,portfolio_url)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [account.name, account.email, hash, account.role, account.company_name || null, account.bio || null,
      account.skills || null, account.hourly_rate || 0, account.portfolio_url || null]
  );
  return result.lastID || result.rows?.[0]?.id;
}

async function seedDemoData() {
  const clientId = await ensureUser(DEMO.client);
  const freelancerId = await ensureUser(DEMO.freelancer);

  let project = await query(
    "SELECT id FROM projects WHERE client_id = ? AND title = ?",
    [clientId, "Build a responsive SaaS landing page"]
  );

  let projectId;
  if (!project.rows.length) {
    const result = await query(
      `INSERT INTO projects (client_id,title,description,budget,skills_required,status)
       VALUES (?,?,?,?,?,?)`,
      [clientId, "Build a responsive SaaS landing page",
        "Create a modern responsive landing page with accessible components, responsive navigation and polished animations.",
        850, "HTML, CSS, JavaScript, UI/UX", "open"]
    );
    projectId = result.lastID || result.rows?.[0]?.id;
  } else {
    projectId = project.rows[0].id;
  }

  const proposal = await query(
    "SELECT id FROM proposals WHERE project_id = ? AND freelancer_id = ?",
    [projectId, freelancerId]
  );
  if (!proposal.rows.length) {
    await query(
      `INSERT INTO proposals (project_id,freelancer_id,bid_amount,delivery_days,cover_letter)
       VALUES (?,?,?,?,?)`,
      [projectId, freelancerId, 750, 7,
        "I can deliver the landing page with a responsive component system, clean JavaScript and a polished UX within one week."]
    );
  }

  return { clientId, freelancerId, projectId };
}

module.exports = { DEMO, seedDemoData };
