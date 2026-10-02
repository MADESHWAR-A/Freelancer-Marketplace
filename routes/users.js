const express = require("express");
const { verifyToken } = require("../middleware/auth");
const { updateProfile, findUser } = require("../controllers/userController");
const router = express.Router();

router.put("/profile", verifyToken, updateProfile);
router.get("/:id", verifyToken, findUser);

module.exports = router;
