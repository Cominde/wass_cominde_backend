const express = require("express");

const {
  signupValidator,
  loginValidator,
} = require("../utils/validators/authValidator");

const {
  protect,
  allowedTo,
  signup,
  login,
  forgotPassword,
  logout,
  resetPassword,
} = require("../services/authServices");

const router = express.Router();

router.route("/signup").post(signupValidator, signup);
router.route("/login").post(loginValidator, login);

router.route("/forgot-password").get(forgotPassword);

router.route("/logout").get(protect, logout);

router.route("/reset-password").put(resetPassword);

module.exports = router;
