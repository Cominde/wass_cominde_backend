const puppeteer = require("puppeteer");
const multer = require("multer");

const fs = require("fs");
const path = require("path");
const { sendEmailWithQRCode, sendEmail } = require("../utils/sendEmail");

const User = require("../models/userModel");
const Key = require("../models/keyModel");
const ApiError = require("../utils/apiError");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + Date.now() + ext);
  },
});

let browser, page;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function initializeBrowser() {
  try {
    browser = await puppeteer.launch({
      headless: true, // Set to false to run in non-headless mode
      // slowMo: 100, // Slow down by 100ms to make actions more visible
      // devtools: true, // Open DevTools automatically
      // args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.88 Safari/537.36"
    );
  } catch (error) {
    console.error("Failed to initialize browser:", error);
    if (browser) await browser.close();
    throw error;
  }
}

const qrCodePath = path.join(__dirname, "qr_code.png");

exports.startSession = async (_, res, next) => {
  try {
    // Initialize browser if not already running

    await initializeBrowser();

    console.log("Browser initialized");

    // Navigate to WhatsApp Web

    try {
      await page.goto("https://web.whatsapp.com", {
        waitUntil: "networkidle0",
        timeout: 60000, // Increase timeout to 60 seconds
      });
    } catch (error) {
      console.error("Failed to navigate to WhatsApp Web:", error);
      throw error;
    }

    console.log("WhatsApp Web loaded");
    await delay(5000); // Reduced initial delay

    // Take QR code screenshot and send email
    await page.screenshot({
      path: qrCodePath,
      // Capture only QR code area
    });

    await sendEmailWithQRCode(qrCodePath).catch((error) =>
      console.error("Failed to send email:", error)
    );

    console.log("QR code generated and sent. Waiting for scan...");

    // Wait for successful login
    await page.waitForSelector('div[role="grid"]', { timeout: 10 * 60000 }); // Wait up to 10 minutes

    // Cleanup QR code image
    fs.unlink(qrCodePath, (err) => {
      if (err) console.error("Error deleting QR code:", err);
    });

    console.log("WhatsApp Web login successful");
    return res.status(200).json({
      status: "success",
      message: "WhatsApp Web login successful",
    });
  } catch (error) {
    console.error("Session start failed:", error.message);

    // Cleanup on error
    if (browser) await browser.close();
    browser = null;
    page = null;

    // Different error responses based on error type
    if (error.name === "TimeoutError") {
      return res.status(408).json({
        status: "error",
        message: "QR code scan timeout - please try again",
      });
    }

    next(error);
  }
};
exports.sendWhatsappMessage = async (req, res, next) => {
  try {
    if (!browser || !page) {
      return res
        .status(400)
        .json({ status: "No active session. Please start a session first." });
    }

    // Validate request body
    const { contact, message, apiKey } = req.body;
    if (!contact || !message) {
      throw new ApiError("contact number and message required");
    }
    if (!apiKey) {
      throw new ApiError("API key required");
    }

    // Verify API key
    let key;
    try {
      key = await Key.findOne({ key: apiKey });
      if (!key) {
        throw new ApiError("Invalid API key");
      }
    } catch (error) {
      throw new ApiError("Error verifying API key");
    }

    // Find user
    let user;
    try {
      user = await User.findById(key.userId);
      if (!user) {
        throw new ApiError("User not found");
      }
    } catch (error) {
      throw new ApiError("Error finding user");
    }

    // Check if key is acitve or not
    if (!key.isActive) {
      throw new ApiError("API key is inactive");
    }
    // Check if api key has quota

    console.log(key.useLimit);
    if (key.useLimit) {
      if (key.usedQuota >= key.quotaLimit) {
        throw new ApiError("Quota limit reached for this API key");
      }
    } else {
      console.log("no limit for key");
    }

    // Handle quota and send message
    try {
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      for (const quota of user.quota) {
        if (new Date(quota.expiresAt) >= currentDate) {
          if (quota.amount > 0) {
            quota.amount -= 1;

            // Send message

            //await quota.save();
            user.activities.push({
              action: `Sent text message to ${contact}`,
            });
            break;
          }
        } else {
          user.quota.pull({ _id: quota._id });
        }
      }
      await user.save();

      key.usedQuota += 1;
      await key.save();
    } catch (error) {
      throw new ApiError(error.message);
    }

    await page.goto("https://web.whatsapp.com");

    try {
      await page.waitForSelector('div[role="grid"]', { timeout: 10000 });
    } catch (error) {
      console.error(error);
      await browser.close();
      return res.status(401).json({ status: "Start new session" });
    }

    try {
      await page.goto(`https://web.whatsapp.com/send?phone=${contact}`, {
        waitUntil: "networkidle2",
      });
      await page.screenshot({
        path: qrCodePath,
        // Capture only QR code area
      });
      await page.waitForSelector('div[contenteditable="true"][data-tab="1"]', {
        timeout: 100000,
      });
      const messageBox = await page.$(
        'div[contenteditable="true"][data-tab="1"]'
      );
      await messageBox.focus();
      await page.type('div[contenteditable="true"][data-tab="1"]', message);
      await page.keyboard.press("Enter");
      await delay(1000);
    } catch (error) {
      return next(error);
    }

    console.log("Messages sent successfully");
    res.json({ status: "Messages sent successfully" });
  } catch (error) {
    console.error("Failed to send WhatsApp message:", error);
    next(error);
  }
};
