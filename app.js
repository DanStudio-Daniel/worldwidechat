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

const messageSchema = new mongoose.Schema({
    mid: { type: String, required: true, unique: true },
    senderName: { type: String, required: true },
    createdAt: { type: Date, expires: 86400, default: Date.now } 
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
            
            sendReadReceipt(senderId);

            const messageText = webhookEvent.message?.text;
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
    // Regex: Only allows A-Z, a-z, and 0-9
    const alphaNumeric = /^[a-zA-Z0-9]+$/;

    // 1. REGISTER COMMAND
    if (lowerText.startsWith("/register")) {
        const name = text.slice(10).trim();
        if (!name) return sendMessage(senderId, "⚠️ 𝐏𝐥𝐞𝐚𝐬𝐞 𝐞𝐧𝐭𝐞𝐫 𝐚 𝐧𝐚𝐦𝐞!\nExample: /register Azuki");
        if (!alphaNumeric.test(name)) return sendMessage(senderId, "❌ 𝐒𝐲𝐦𝐛𝐨𝐥𝐬 𝐧𝐨𝐭 𝐚𝐥𝐥𝐨𝐰𝐞𝐝!\nUse only letters and numbers.");
        if (name.length < 2 || name.length > 10) return sendMessage(senderId, "❌ 𝐈𝐧𝐯𝐚𝐥𝐢𝐝 𝐍𝐚𝐦𝐞!\nUse 2-10 characters only.");

        try {
            const existingUser = await User.findOne({ senderId });
            if (existingUser) return sendMessage(senderId, "✅ 𝐘𝐨𝐮 𝐚𝐫𝐞 𝐚𝐥𝐫𝐞𝐚𝐝𝐲 𝐫𝐞𝐠𝐢𝐬𝐭𝐞𝐫𝐞𝐝 𝐚𝐬\n" + toBoldFont(existingUser.name));

            const nameTaken = await User.findOne({ name: name });
            if (nameTaken) return sendMessage(senderId, "❌ 𝐒𝐨𝐫𝐫𝐲!\nName " + toBoldFont(name) + " is already taken.");

            await new User({ senderId, name }).save();
            sendMessage(senderId, "╔══════════════════╗\n    🎉 𝐖𝐄𝐋𝐂𝐎𝐌𝐄 🎉\n╚══════════════════╝\n\n𝐇𝐞𝐥𝐥𝐨 " + toBoldFont(name) + "!\n\n📌 𝐂𝐨𝐦𝐦𝐚𝐧𝐝𝐬:\n✏️ /changename <name>\n📥 join\n📤 leave\n\n✅ 𝐘𝐨𝐮 𝐜𝐚𝐧 𝐜𝐡𝐚𝐧𝐠𝐞 𝐧𝐚𝐦𝐞 𝐚𝐧𝐲𝐭𝐢𝐦𝐞!\n\n𝐓𝐲𝐩𝐞 '𝐣𝐨𝐢𝐧' 𝐭𝐨 𝐞𝐧𝐭𝐞𝐫 𝐜𝐡𝐚𝐭.");
        } catch (err) { sendMessage(senderId, "❌ Error registering."); }
        return;
    }

    const user = await User.findOne({ senderId });
    if (!user) return sendMessage(senderId, "👋 𝐇𝐞𝐥𝐥𝐨! 𝐖𝐞𝐥𝐜𝐨𝐦𝐞 𝐭𝐨 𝐆𝐥𝐨𝐛𝐚𝐥 𝐂𝐡𝐚𝐭!\n\n📝 𝐓𝐲𝐩𝐞: /register YourName");

    // 2. CHANGE NAME COMMAND
    if (lowerText.startsWith("/changename")) {
        const newName = text.slice(12).trim();
        if (!newName) return sendMessage(senderId, "⚠️ 𝐏𝐥𝐞𝐚𝐬𝐞 𝐞𝐧𝐭𝐞𝐫 𝐲𝐨𝐮𝐫 𝐧𝐞𝐰 𝐮𝐬𝐞𝐫𝐧𝐚𝐦𝐞!\nExample: /changename NewName");
        if (!alphaNumeric.test(newName)) return sendMessage(senderId, "❌ 𝐒𝐲𝐦𝐛𝐨𝐥𝐬 𝐧𝐨𝐭 𝐚𝐥𝐥𝐨𝐰𝐞𝐝!\nUse only letters and numbers.");
        if (newName.length < 2 || newName.length > 10) return sendMessage(senderId, "❌ 𝐈𝐧𝐯𝐚𝐥𝐢𝐝 𝐍𝐚𝐦𝐞!\nUse 2-10 characters only.");

        try {
            const nameTaken = await User.findOne({ name: newName });
            if (nameTaken) return sendMessage(senderId, "❌ 𝐒𝐨𝐫𝐫𝐲!\nName " + toBoldFont(newName) + " is already taken.");

            await User.updateOne({ senderId }, { name: newName });
            sendMessage(senderId, "✅ 𝐍𝐚𝐦𝐞 𝐮𝐩𝐝𝐚𝐭𝐞𝐝 𝐭𝐨\n" + toBoldFont(newName));
        } catch (err) { sendMessage(senderId, "❌ Error changing name."); }
        return;
    }

    // 3. JOIN COMMAND
    if (lowerText === "join") {
        if (user.active) return sendMessage(senderId, "ℹ️ 𝐘𝐨𝐮 𝐚𝐫𝐞 𝐚𝐥𝐫𝐞𝐚𝐝𝐲 𝐢𝐧 𝐭𝐡𝐞 𝐜𝐡𝐚𝐭!");
        await User.updateOne({ senderId }, { active: true });
        sendMessage(senderId, "📥 𝐉𝐨𝐢𝐧𝐞𝐝 𝐬𝐮𝐜𝐜𝐞𝐬𝐬𝐟𝐮𝐥𝐥𝐲!");
        return broadcastSystem(toBoldFont(user.name) + " joined the chat. ✅");
    }

    // 4. LEAVE COMMAND
    if (lowerText === "leave") {
        if (!user.active) return sendMessage(senderId, "ℹ️ 𝐘𝐨𝐮 𝐚𝐫𝐞 𝐧𝐨𝐭 𝐢𝐧 𝐭𝐡𝐞 𝐜𝐡𝐚𝐭.");
        await User.updateOne({ senderId }, { active: false });
        sendMessage(senderId, "📤 𝐋𝐞𝐟𝐭 𝐭𝐡𝐞 𝐜𝐡𝐚𝐭.");
        return broadcastSystem(toBoldFont(user.name) + " left the chat. ❌");
    }

    // 5. GLOBAL CHAT
    if (user.active) {
        let header = toBoldFont(user.name);
        if (replyToMid) {
            const originalMsg = await MessageLog.findOne({ mid: replyToMid });
            header = originalMsg ? `${toBoldFont(user.name)} replied to ${toBoldFont(originalMsg.senderName)}` : `${toBoldFont(user.name)} replied to System`;
        }

        const output = `${header}\n${text}`;
        const activeUsers = await User.find({ active: true, senderId: { $ne: senderId } });
        activeUsers.forEach(u => sendAndLogMessage(u.senderId, output, user.name));
    } else {
        sendMessage(senderId, "🔒 𝐘𝐨𝐮 𝐚𝐫𝐞 𝐧𝐨𝐭 𝐢𝐧 𝐭𝐡𝐞 𝐜𝐡𝐚𝐭.\n𝐓𝐲𝐩𝐞 '𝐣𝐨𝐢𝐧' 𝐭𝐨 𝐩𝐚𝐫𝐭𝐢𝐜𝐢𝐩𝐚𝐭𝐞.");
    }
}

// ==========================================
// HELPERS
// ==========================================

function sendReadReceipt(senderId) {
    request({
        uri: "https://graph.facebook.com/v18.0/me/messages",
        qs: { access_token: PAGE_ACCESS_TOKEN },
        method: "POST",
        json: { recipient: { id: senderId }, sender_action: "mark_seen" }
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

function sendAndLogMessage(recipientId, text, senderNameForLog) {
    request({
        uri: "https://graph.facebook.com/v18.0/me/messages",
        qs: { access_token: PAGE_ACCESS_TOKEN },
        method: "POST",
        json: { recipient: { id: recipientId }, message: { text: text } }
    }, async (error, res, body) => {
        if (!error && body.message_id) {
            await new MessageLog({ mid: body.message_id, senderName: senderNameForLog }).save();
        }
    });
}

async function broadcastSystem(text) {
    const activeUsers = await User.find({ active: true });
    activeUsers.forEach(u => sendMessage(u.senderId, text));
}

app.listen(process.env.PORT || 3000, () => console.log("Server Running 🚀"));
