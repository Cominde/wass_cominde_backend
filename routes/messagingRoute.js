const express = require("express");
const { sendWhatsappMessage, startSession } = require("../services/messagingServices");
const { sendMessage } = require("../services/messagingServices");

const router = express.Router();

router.route("/send-message").post(sendWhatsappMessage);
router.route("/start-session").post(startSession);

module.exports = router;
