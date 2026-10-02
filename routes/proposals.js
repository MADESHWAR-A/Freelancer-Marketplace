const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");
const { createProposal, myBids } = require("../controllers/proposalController");
const router = express.Router();

router.post("/", verifyToken, requireRole("freelancer"), createProposal);
router.get("/my-bids", verifyToken, requireRole("freelancer"), myBids);

module.exports = router;
