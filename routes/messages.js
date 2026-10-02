const express = require("express");
const { verifyToken } = require("../middleware/auth");
const { history } = require("../controllers/messageController");
const router = express.Router();

router.get("/:otherUserId", verifyToken, history);

module.exports = router;
