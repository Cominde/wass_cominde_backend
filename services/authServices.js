const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const ApiError = require("../utils/apiError.js");
const createToken = require("../utils/createToken");
const crypto = require('crypto');
const {sendEmail} = require('../utils/sendEmail');
// Signup Service
exports.signup = async (req, res, next) => {
  try {
    // Check if user exists
    const user = await User.findOne({ email: req.body.email });
    if (user) {
      throw new ApiError("Email already exists", 400);
    }
    // Get password and ensure it's a string
    let password = req.body.password;
    password = String(password);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new user
    const newUser = await User.create({
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword,
      activities: [{ action: "User account created" }],
    });

    if (!newUser) {
      throw new ApiError("Failed to create user", 500);
    }

    // Generate token
    const token = createToken({ userId: newUser._id });
    res.status(201).json({ data: newUser, token: token });
  } catch (error) {
    next(error);
  }
};

// Login Service
exports.login = async (req, res, next) => {
  try {
    const user = await User.findOne({email: req.body.email});

    if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
      throw new ApiError("Incorrect email or password", 401);
    }

    // Add login activity
    user.activities.push({ action: "User logged in" });
    await user.save();

    const token = createToken( user._id );
   // res.status(201).json({ data: user, token: token });
  const userWithoutPassword = { ...user.toObject() };
  delete userWithoutPassword.password;
  delete userWithoutPassword.passwordResetToken;
  delete userWithoutPassword.passwordResetExpires;
//  delete userWithoutPassword.keys;
  res.status(201).json({ data: userWithoutPassword, token: token });
  } catch (error) {
    next(error);
  }
};


exports.protect = async (req, res, next) => {
  try {
    //1) check if token exists, if exists, get
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token) {
      return next(
        new ApiError(
          "your are not logged in , please login to get access this route"
        ),
        401
      );
    }

    //2) verify token (no change happens, expired token)
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    console.log(decoded);

    //3) check if user exists
    const currentUser = await User.findById(decoded.userId);
    if (!currentUser) {
      return next(
        new ApiError(
          "The user that belong to this token does no longer exist",
          401
        )
      );
    }

    //4) check if user change his password after token created
    if (currentUser.passwordChangedAt) {
      const passChangedTimestamp = parseInt(
        currentUser.passwordChangedAt.getTime() / 1000,
        10
      );
      // Password changed after token created (Error)
      if (passChangedTimestamp > decoded.iat) {
        return next(
          new ApiError(
            "User recently changed his password. please login again..",
            401
          )
        );
      }
    }

    req.user = currentUser;
    next();
  } catch (error) {
    next(error);
  }
};

exports.allowedTo =
  (...roles) =>
  async (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError("you are not allowed to perform this action", 403)
      );
    }
    next();
  };








// Logout Service
exports.logout = async (req,res,next) => {
  try {
    let user=req.user;
    if (!user) {
      throw new ApiError("User not found", 404);
    }

    // Add logout activity

    user.activities.push({ action: "User logged out" });
    await user.save();
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    next( error);
  }
};

// Reset Password Request
exports.forgotPassword = async (req,res,next) => {
  try {

    const email=req.body.email;
    if (!email) {
      throw new ApiError("Please provide an email address", 400);
    }
    // Check if user exists

    const user = await User.findOne({ email });
    if (!user) {
      throw new ApiError("No user found with this email", 404);
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex").slice(0, 6);
    user.passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save();

    // Send email
    const message = `
      <h1>Password Reset Request</h1>
      <p>You are receiving this email because you (or someone else) has requested a password reset for your account.</p>
      <p>Your OTP for password reset is: <strong>${resetToken}</strong></p>
      <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
    `;

    await sendEmail({
      to: user.email,
      subject: "Password Reset Request",
      message: message
    });
    user.activities.push({ action: "password reset request" });

    await user.save();

    res.status(200).json({
      status: "success",
      message: "Reset password email sent",
    });
    
  } catch (error) {
    next( error);
  }
};

// Reset Password
exports.resetPassword = async (req,res,next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      throw new ApiError("Token and new password required", 400);
    }
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw new ApiError("Token is invalid or has expired", 400);
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.activities.push({ action: "Password reset" });

    await user.save();
    res.status(200).json({
      status: "success",
      message: "Password reset successful",
    });
  } catch (error) {
    next(error);
  }
};


