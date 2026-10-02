const express = require("express");
const { register, login, me, logout } = require("../controllers/authController");
const { verifyToken } = require("../middleware/auth");
const { registerValidation } = require("../middleware/validate");
const router = express.Router();

router.post("/register", registerValidation, register);
router.post("/login", login);
router.get("/me", verifyToken, me);
router.post("/logout", logout);

module.exports = router;
