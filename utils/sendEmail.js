const nodemailer = require("nodemailer");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail", // true for 465, false for other ports
  auth: {
    // user: process.env.NODEMAILER_EMAIL, // Your email address
    // pass: process.env.NODEMAILER_PASS,
    user: "cominde.tech@gmail.com" , // Your email address
    pass: "obuw gfkt qnwn gttv",
    // Your email app password
  },
  tls: {
    rejectUnauthorized: false,
  },
 
});
const sendEmail = async (options) => {
  // Create a transporter

  // Define email options
  const mailOptions = {
    from: process.env.NODEMAILER_EMAIL,
    to: options.to, // Allow recipient to be passed in options
    subject: options.subject || "Message from Contact Form",
    text: options.message || "Message",
    html: options.message,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: ", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email: ", error);
    throw error;
  }
};

const sendEmailWithQRCode = async (qrCodePath) => {
  const mailOptions = {
    from: process.env.NODEMAILER_EMAIL,
    to: ["abdelrahmanl2004@gmail.com", "joeshwoa.george@gmail.com"], // Add second email here
    subject: "WhatsApp QR Code",
    text: "Please scan the attached QR code to log in.",
    attachments: [
                  {
                      filename: path.basename(qrCodePath),
                      path: qrCodePath,
                  },
              ],
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendEmailWithQRCode, sendEmail };
