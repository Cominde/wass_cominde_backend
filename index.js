const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const { Client, RemoteAuth, MessageMedia } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { dbConnection } = require('./config/database'); // Assuming you have a file named dbConnection.js that exports mongooseConnection
const app = express();
const {sendEmailWithQRCode,sendEmail}=require("./utils/sendEmail")
let store;
let client

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '_' + formatDateForFile(new Date()) + ext);
    }
});

const upload = multer({ storage: storage });

dbConnection.then(() => {
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

// const transporter = nodemailer.createTransport({
//     service: 'gmail',
//     auth: {
//         user: 'cominde.tech@gmail.com',
//         pass: 'obuw gfkt qnwn gttv',
//     },
// });

function dateComponentPad(value) {
    var format = String(value);
  
    return format.length < 2 ? '0' + format : format;
}

function formatDate(date) {
    var datePart = [ date.getFullYear(), date.getMonth() + 1, date.getDate() ].map(dateComponentPad);
    var timePart = [ date.getHours(), date.getMinutes()].map(dateComponentPad);
  
    return datePart.join('-') + ' ' + timePart.join(':');
}

function formatDateForFile(date) {
    var datePart = [ date.getFullYear(), date.getMonth() + 1, date.getDate() ].map(dateComponentPad);
    var timePart = [ date.getHours(), date.getMinutes()].map(dateComponentPad);
  
    return datePart.join('-') + '_' + timePart.join('-');
}

// async function sendEmailWithQRCode(qrCodePath) {
//     const mailOptions = {
//         from: 'cominde.tech@gmail.com',
//         to: 'joeshwoa.george@gmail.com',
//         subject: 'WhatsApp QR Code',
//         text: 'Please scan the attached QR code to log in.',
//         attachments: [
//             {
//                 filename: path.basename(qrCodePath),
//                 path: qrCodePath,
//             },
//         ],
//     };

//     await transporter.sendMail(mailOptions);
// }

// async function sendTextEmail(text) {
//     const mailOptions = {
//         from: 'cominde.tech@gmail.com',
//         to: 'joeshwoa.george@gmail.com',
//         subject: 'WhatsApp Session State',
//         text: text,
//     };

//     await transporter.sendMail(mailOptions);
// }

app.post('/start_session', async (req, res) => {
    newSession = false;
    client.on('qr', async (qr) => {
        newSession = true;
        const qrCodePath = path.join(__dirname, 'qr_code.png');
        await QRCode.toFile(qrCodePath, qr);
        await sendEmailWithQRCode(qrCodePath);
        sendEmail(formatDate(new Date())+': Please scan the QR code to start a WhatsApp session.');
        console.log(formatDate(new Date())+': QR CODE SENT');
    });

    client.on('authenticated', async () => {
        sendEmail(formatDate(new Date())+': WhatsApp session is authenticated.');
        console.log(formatDate(new Date())+': AUTHENTICATION SUCCESS');
    });

    client.on('ready', () => {
        sendEmail(formatDate(new Date())+': WhatsApp session is ready.');
        console.log(formatDate(new Date())+': SESSION READY');
        if(!newSession) {
            res.status(200).json({ status: 'Saved session started successfully' });
        }
    });

    client.on('auth_failure', msg => {
        sendEmail(formatDate(new Date())+': WhatsApp session authentication failed.');
        console.error(formatDate(new Date())+': AUTHENTICATION FAILURE', msg);
    });

    client.on('disconnected', (reason) => {
        sendEmail(formatDate(new Date())+': WhatsApp session disconnected.');
        console.log(formatDate(new Date())+': SESSION DISCONNECTED', reason);
    });

    client.on('remote_session_saved', () => {
        sendEmail(formatDate(new Date())+': WhatsApp session saved.');
        console.log(formatDate(new Date())+': SESSION SAVED');
        if(newSession) {
            res.status(200).json({ status: 'Session started and saved successfully' });
        }
    });

    await client.initialize();
});

app.post('/send_message', upload.single('file'), async (req, res) => {
    if (!client.info) {
        return res.status(400).json({ status: 'No active session. Please start a session first.' });
    }

    const contact = req.body.contact;
    const message = req.body.message;
    const filePath = req.file ? req.file.path : null; 
    
    try {
        const chatId = `${contact}@c.us`;
        if (req.file) {
            const media = MessageMedia.fromFilePath(filePath);
            await client.sendMessage(chatId, media, { caption: message });
        } else {
            await client.sendMessage(chatId, message);
        }
        console.log(formatDate(new Date())+`: MESSAGE SENT TO ${contact}`);
    } catch (error) {
        console.error(formatDate(new Date())+`: MESSAGE FIELD SENT TO ${contact}:`, error);
    }
    if(filePath) {
        fs.unlinkSync(filePath);
    }
    res.json({ status: 'Messages sent successfully' });
});

