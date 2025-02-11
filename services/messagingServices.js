const multer = require("multer");

const fs = require("fs");
const path = require("path");
const { sendEmailWithQRCode, sendEmail } = require("../utils/sendEmail");

const User = require("../models/userModel");
const Key = require("../models/keyModel");
const ApiError = require("../utils/apiError");

const mongoose = require("mongoose");
const { Client, RemoteAuth, MessageMedia } = require("whatsapp-web.js");
const { MongoStore } = require("../mongo-store-edited");
const QRCode = require("qrcode");
const mongoose =require ('mongoose');
const { dbConnection } = require("../config/database"); // Assuming you have a file named dbConnection.js that exports mongooseConnection
let store;
let client;

mongoose.connect(process.env.MONGO_URL).then(() => {
  console.log(formatDate(new Date())+': DATABASE CONNECTED');
  store = new MongoStore({ mongoose: mongoose });

  client = new Client({
      clientId: 'main',
      authStrategy: new RemoteAuth({
          store: store,
          backupSyncIntervalMs: 300000
      }),
      puppeteer: {
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
      }
  });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "/tmp/uploads/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "_" + formatDateForFile(new Date()) + ext);
  },
});

const upload = multer({ storage: storage });

function dateComponentPad(value) {
  var format = String(value);

  return format.length < 2 ? "0" + format : format;
}

function formatDate(date) {
  var datePart = [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(
    dateComponentPad
  );
  var timePart = [date.getHours(), date.getMinutes()].map(dateComponentPad);

  return datePart.join("-") + " " + timePart.join(":");
}

function formatDateForFile(date) {
  var datePart = [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(
    dateComponentPad
  );
  var timePart = [date.getHours(), date.getMinutes()].map(dateComponentPad);

  return datePart.join("-") + "_" + timePart.join("-");
}

// async function sendTextEmail(text) {
mailOptions = function (text) {
  return {
    from: "cominde.tech@gmail.com",
    to: ["joeshwoa.george@gmail.com", "abdelrahmanl2004@gmail.com"],
    subject: "WhatsApp Session State",
    text: `${text}`,
  };
};

//     await transporter.sendMail(mailOptions);
// }
const qrCodePath = path.join(__dirname, "qr_code.png");

exports.startSession = async (req, res, next) => {
  try {
    let newSession = false;

    client.on("qr", async (qr) => {
      try {
        newSession = true;
        const qrCodePath = path.join(__dirname, "qr_code.png");
        await QRCode.toFile(qrCodePath, qr);
        console.log(qrCodePath);
        await sendEmailWithQRCode(qrCodePath);
        console.log(formatDate(new Date()) + ": QR CODE SENT");
      } catch (error) {
        console.error(formatDate(new Date()) + ": Failed to send QR code:", error);
        next(new ApiError("Failed to send QR code"));
      }
    });

    client.on("authenticated", async () => {
      try {
        await sendEmail(mailOptions(formatDate(new Date()) + ": WhatsApp session is authenticated."));
        console.log(formatDate(new Date()) + ": AUTHENTICATION SUCCESS");
      } catch (error) {
        console.error(formatDate(new Date()) + ": Failed to send authentication email:", error);
        next(new ApiError("Failed to send authentication email"));
      }
    });

    client.on("ready", () => {
      try {
        sendEmail(mailOptions(formatDate(new Date()) + ": WhatsApp session is ready."));
        console.log(formatDate(new Date()) + ": SESSION READY");
        if (!newSession) {
          res.status(200).json({ status: "Saved session started successfully" });
        }
      } catch (error) {
        console.error(formatDate(new Date()) + ": Failed to send ready email:", error);
        next(new ApiError("Failed to send ready email"));
      }
    });

    client.on("auth_failure", (msg) => {
      try {
        sendEmail(mailOptions(formatDate(new Date()) + ": WhatsApp session authentication failed."));
        console.error(formatDate(new Date()) + ": AUTHENTICATION FAILURE", msg);
      } catch (error) {
        console.error(formatDate(new Date()) + ": Failed to send authentication failure email:", error);
        next(new ApiError("Failed to send authentication failure email"));
      }
    });

    client.on("disconnected", (reason) => {
      try {
        sendEmail(mailOptions(formatDate(new Date()) + ": WhatsApp session disconnected."));
        console.log(formatDate(new Date()) + ": SESSION DISCONNECTED", reason);
      } catch (error) {
        console.error(formatDate(new Date()) + ": Failed to send disconnection email:", error);
        next(new ApiError("Failed to send disconnection email"));
      }
    });

    client.on("remote_session_saved", () => {
      try {
        sendEmail(mailOptions(formatDate(new Date()) + ": WhatsApp session saved."));
        console.log(formatDate(new Date()) + ": SESSION SAVED");
        if (newSession) {
          res.status(200).json({ status: "Session started and saved successfully" });
        }
      } catch (error) {
        console.error(formatDate(new Date()) + ": Failed to send session saved email:", error);
        next(new ApiError("Failed to send session saved email"));
      }
    });

    await client.initialize();
  } catch (error) {
    console.error("Failed to start WhatsApp session:", error);
    next(new ApiError(error.message));
  }
};

exports.sendWhatsappMessage = async (req, res, next) => {
  try {
    if (!client.info) {
      return res
        .status(400)
        .json({ status: "No active session. Please start a session first." });
    }

    // Validate request body
    const { contact, message, apiKey } = req.body;
    if (!contact || !message) {
      throw new ApiError("contact number and message required");
    }

    // Validate contact number format
    const contactRegex = /^\d+$/;
    if (!contactRegex.test(contact)) {
      throw new ApiError("Invalid contact number format");
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

    // Send message

    const filePath = req.file ? req.file.path : null;

    try {
      console.log (contact)
      const chatId = `${contact}@c.us`;
      if (req.file) {
        const media = MessageMedia.fromFilePath(filePath);
        await client.sendMessage(chatId, media, { caption: message });
      } else {
        await client.sendMessage(chatId, message);
      }
      console.log(formatDate(new Date()) + `: MESSAGE SENT TO ${contact}`);
    } catch (error) {
      console.error(
        formatDate(new Date()) + `: MESSAGE FIELD SENT TO ${contact}:`,
        error
      );
    }
    if (filePath) {
      fs.unlinkSync(filePath);
    }
    res.json({ status: "Messages sent successfully" });

  } catch (error) {
    console.error("Failed to send WhatsApp message:", error);
    next(error);
  }
};
