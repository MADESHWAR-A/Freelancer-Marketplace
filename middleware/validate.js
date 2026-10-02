function cleanText(value, max = 5000) {
  return String(value ?? "").replace(/[<>]/g, "").trim().slice(0, max);
}

function required(fields) {
  return (req, res, next) => {
    for (const field of fields) {
      if (!String(req.body?.[field] ?? "").trim()) {
        return res.status(400).json({ error: `${field} is required` });
      }
    }
    next();
  };
}

function registerValidation(req, res, next) {
  const { name, email, password, role } = req.body || {};
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!name || !normalizedEmail || !password || !role) {
    return res.status(400).json({ error: "Name, email, password and role are required" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: "Password must contain at least 8 characters" });
  }
  if (!["client", "freelancer"].includes(role)) {
    return res.status(400).json({ error: "Invalid account role" });
  }
  req.body.name = cleanText(name, 120);
  req.body.email = normalizedEmail;
  req.body.password = String(password);
  next();
}

function projectValidation(req, res, next) {
  const { title, description, budget, skills_required } = req.body || {};
  const amount = Number(budget);
  if (!title || !description || !skills_required) {
    return res.status(400).json({ error: "Title, description, budget and required skills are required" });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "Budget must be a positive number" });
  }
  req.body.title = cleanText(title, 160);
  req.body.description = cleanText(description, 5000);
  req.body.skills_required = cleanText(skills_required, 500);
  req.body.budget = amount;
  next();
}

module.exports = { cleanText, required, registerValidation, projectValidation };
