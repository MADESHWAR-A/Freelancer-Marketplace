const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");
const { projectValidation } = require("../middleware/validate");
const { createProject, myProjects, proposalsForProject, openProjects } = require("../controllers/projectController");
const { updateProposalStatus } = require("../controllers/proposalController");
const router = express.Router();

router.get("/", verifyToken, openProjects);
router.post("/", verifyToken, requireRole("client"), projectValidation, createProject);
router.get("/my-projects", verifyToken, requireRole("client"), myProjects);
router.get("/:id/proposals", verifyToken, requireRole("client"), proposalsForProject);
router.put("/proposals/:id/status", verifyToken, requireRole("client"), updateProposalStatus);

module.exports = router;
