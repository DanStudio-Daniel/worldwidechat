const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const mongoose = require('mongoose');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// ==========================================
// CONFIGURATION
// ==========================================
const PAGE_ACCESS_TOKEN = "EAAW7bgNPIuABRSRfRa1O33UZAR8GAq7QV26jBrsVlvPz7PXqh9QbSvKDsz9GxrsIrpImMzpwGLGy8jyraQABZBFVOuWtxKvlOZBeXZBW7oStGpAGXYcVqIrbZBrB8wG6ZBMwsvMUYf725t09lcziBuP6ppcpMx2daO48n5JPVSs5OvTSJN4gffKoo3ZA2dM8l93v6RppwZDZD";
const VERIFY_TOKEN = "key";

const mongoURI = "mongodb+srv://danielmojar84_db_user:nDG9hpTU0uHZtxYO@cluster0.wsk0egt.mongodb.net/?appName=Cluster0";
mongoose.connect(mongoURI, { dbName: "strangerchat" })
  .then(() => console.log("MongoDB Connected ✅"))
  .catch(err => console.log("DB Connection Error:", err));

// ==========================================
// SCHEMAS
// ==========================================
const userSchema = new mongoose.Schema({
    senderId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    active: { type: Boolean, default: false }
});
const User = mongoose.model("globalusers", userSchema);

// New Schema to track Message IDs
const messageSchema = new mongoose.Schema({
    mid: { type: String, required: true, unique: true },
    senderName: { type: String, required: true },
    createdAt: { type: Date, expires: 86400, default: Date.now } // Auto-delete after 24h
});
const MessageLog = mongoose.model("messagelogs", messageSchema);

// ==========================================
// FONT CONVERTER
// ==========================================
function toBoldFont(text) {
    const normal = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const bold = ["𝐀","𝐁","𝐂","𝐃","𝐄","𝐅","𝐆","𝐇","𝐈","𝐉","𝐊","𝐋","𝐌","𝐍","𝐎","𝐏","𝐐","𝐑","𝐒","𝐓","𝐔","𝐕","𝐖","𝐗","𝐘","𝐙","𝐚","𝐛","𝐜","𝐝","𝐞","𝐟","𝐠","𝐡","𝐢","𝐣","𝐤","𝐥","𝐦","𝐧","𝐨","𝐩","𝐪","𝐫","𝐬","𝐭","𝐮","𝐯","𝐰","𝐱","𝐲","𝐳","𝟎","𝟏","𝟐","𝟑","𝟒","𝟓","𝟔","𝟕","𝟖","𝟗"];
    return Array.from(text).map(char => {
        const index = normal.indexOf(char);
        return index !== -1 ? bold[index] : char;
    }).join("");
}

// ==========================================
// WEBHOOKS
// ==========================================
app.get("/webhook", (req, res) => {
    if (req.query["hub.mode"] && req.query["hub.verify_token"] === VERIFY_TOKEN) {
        res.status(200).send(req.query["hub.challenge"]);
    } else {
        res.sendStatus(403);
    }
});

app.post("/webhook", (req, res) => {
    const body = req.body;
    if (body.object === "page") {
        body.entry.forEach(entry => {
            const webhookEvent = entry.messaging[0];
            const senderId = webhookEvent.sender.id;
            const messageText = webhookEvent.message?.text;
            
            // Detect the Message ID being replied to
            let replyToMid = null;
            if (webhookEvent.message && webhookEvent.message.reply_to) {
                replyToMid = webhookEvent.message.reply_to.mid;
            }

            if (messageText) {
                handleMessage(senderId, messageText, replyToMid);
            }
        });
        res.status(200).send("EVENT_RECEIVED");
    } else {
        res.sendStatus(404);
    }
});

// ==========================================
// MAIN LOGIC
// ==========================================
async function handleMessage(senderId, text, replyToMid) {
    const lowerText = text.toLowerCase().trim();
    const user = await User.findOne({ senderId });

    // Registration Logic
    if (lowerText.startsWith("/register ")) {
        const name = text.slice(10).trim();
        if (name.includes(" ") || name.length < 2 || name.length > 10) {
            return sendMessage(senderId, "❌ 𝐈𝐧𝐯𝐚𝐥𝐢𝐝! Use 2-10 chars, no spaces.");
        }
        try {
            if (user) return sendMessage(senderId, "✅ Registered as: " + toBoldFont(user.name));
            const nameTaken = await User.findOne({ name });
            if (nameTaken) return sendMessage(senderId, "❌ Name taken.");
            await new User({ senderId, name }).save();
            sendMessage(senderId, "🎉 𝐖𝐞𝐥𝐜𝐨𝐦𝐞 " + toBoldFont(name) + "!\nType 'join' to start.");
        } catch (e) { sendMessage(senderId, "❌ Error."); }
        return;
    }

    if (!user) return sendMessage(senderId, "👋 Type /register YourName");

    // Join/Leave Logic
    if (lowerText === "join") {
        await User.updateOne({ senderId }, { active: true });
        return broadcastSystem(toBoldFont(user.name) + " joined! ✅");
    }
    if (lowerText === "leave") {
        await User.updateOne({ senderId }, { active: false });
        return broadcastSystem(toBoldFont(user.name) + " left! ❌");
    }

    // Chat Logic
    if (user.active) {
        let header = toBoldFont(user.name);
        
        if (replyToMid) {
            const originalMsg = await MessageLog.findOne({ mid: replyToMid });
            if (originalMsg) {
                header = `${toBoldFont(user.name)} 𝐫𝐞𝐩𝐥𝐢𝐞𝐝 𝐭𝐨 ${toBoldFont(originalMsg.senderName)}`;
            } else {
                header = `${toBoldFont(user.name)} 𝐫𝐞𝐩𝐥𝐢𝐞𝐝 𝐭𝐨 𝐒𝐲𝐬𝐭𝐞𝐦`;
            }
        }

        const output = `${header}\n${text}`;
        const activeUsers = await User.find({ active: true, senderId: { $ne: senderId } });
        
        activeUsers.forEach(u => {
            sendAndLogMessage(u.senderId, output, user.name);
        });
    } else {
        sendMessage(senderId, "🔒 Type 'join' to chat.");
    }
}

// ==========================================
// HELPERS
// ==========================================

// Sends message AND saves the MID so people can reply to it
function sendAndLogMessage(recipientId, text, senderNameForLog) {
    request({
        uri: "https://graph.facebook.com/v18.0/me/messages",
        qs: { access_token: PAGE_ACCESS_TOKEN },
        method: "POST",
        json: { recipient: { id: recipientId }, message: { text: text } }
    }, async (error, res, body) => {
        if (!error && body.message_id) {
            // Save this message ID so we know who sent it if someone replies
            await new MessageLog({ 
                mid: body.message_id, 
                senderName: senderNameForLog 
            }).save();
        }
    });
}

function sendMessage(senderId, text) {
    request({
        uri: "https://graph.facebook.com/v18.0/me/messages",
        qs: { access_token: PAGE_ACCESS_TOKEN },
        method: "POST",
        json: { recipient: { id: senderId }, message: { text: text } }
    });
}

async function broadcastSystem(text) {
    const activeUsers = await User.find({ active: true });
    activeUsers.forEach(u => sendMessage(u.senderId, text));
}

app.listen(process.env.PORT || 3000, () => console.log("Running... 🚀"));
