const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const mongoose = require('mongoose');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// ==========================================
// HOMEPAGE
// ==========================================
app.get("/", (req, res) => {
    res.send("<h1>Test Bot is Running ✅</h1>");
});

// ==========================================
// CONFIGURATION
// ==========================================
const PAGE_ACCESS_TOKEN = "EAAW7bgNPIuABRSRfRa1O33UZAR8GAq7QV26jBrsVlvPz7PXqh9QbSvKDsz9GxrsIrpImMzpwGLGy8jyraQABZBFVOuWtxKvlOZBeXZBW7oStGpAGXYcVqIrbZBrB8wG6ZBMwsvMUYf725t09lcziBuP6ppcpMx2daO48n5JPVSs5OvTSJN4gffKoo3ZA2dM8l93v6RppwZDZD";
const VERIFY_TOKEN = "key";

// MongoDB Connection
const mongoURI = "mongodb+srv://danielmojar84_db_user:nDG9hpTU0uHZtxYO@cluster0.wsk0egt.mongodb.net/?appName=Cluster0";
mongoose.connect(mongoURI, {
    dbName: "strangerchat"
}).then(() => console.log("MongoDB Connected ✅"))
  .catch(err => console.log("DB Connection Error:", err));

// User Schema & Model
const userSchema = new mongoose.Schema({
    senderId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    active: { type: Boolean, default: false }
});

const User = mongoose.model("globalusers", userSchema);

// ==========================================
// FONT CONVERTER - BOLD SERIF
// ==========================================
function toBoldFont(text) {
    const normal = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const bold   = "𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗";
    
    let result = "";
    for (let i = 0; i < text.length; i++) {
        let char = text[i];
        let index = normal.indexOf(char);
        if (index !== -1) {
            result += bold[index];
        } else {
            result += char;
        }
    }
    return result;
}

// ==========================================
// FACEBOOK WEBHOOK
// ==========================================
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token === VERIFY_TOKEN) {
        res.status(200).send(challenge);
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
            
            // DETECT REPLY
            let repliedToId = null;
            if (webhookEvent.message && webhookEvent.message.reply_to) {
                repliedToId = webhookEvent.message.reply_to.sender_id;
            }

            if (messageText) {
                handleMessage(senderId, messageText, repliedToId);
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
async function handleMessage(senderId, text, repliedToId) {
    const lowerText = text.toLowerCase().trim();

    // 1. REGISTER COMMAND
    if (lowerText.startsWith("/register ")) {
        const name = text.slice(10).trim();
        
        if (name.includes(" ")) {
            return sendMessage(senderId, "❌ 𝐄𝐫𝐫𝐨𝐫!\nSpace is not allowed in name!\nUse: /register YourName");
        }
        
        if (name.length < 2 || name.length > 10) {
            return sendMessage(senderId, "❌ 𝐈𝐧𝐯𝐚𝐥𝐢𝐝 𝐍𝐚𝐦𝐞!\nUse 2-10 characters only.");
        }

        try {
            const existingUser = await User.findOne({ senderId });
            if (existingUser) {
                return sendMessage(senderId, "✅ 𝐘𝐨𝐮 𝐚𝐫𝐞 𝐚𝐥𝐫𝐞𝐚𝐝𝐲 𝐫𝐞𝐠𝐢𝐬𝐭𝐞𝐫𝐞𝐝 𝐚𝐬\n" + toBoldFont(existingUser.name));
            }

            const nameTaken = await User.findOne({ name: name });
            if (nameTaken) {
                return sendMessage(senderId, "❌ 𝐒𝐨𝐫𝐫𝐲!\nName " + toBoldFont(name) + " is already taken.");
            }

            const newUser = new User({ senderId, name });
            await newUser.save();
            
            sendMessage(senderId, "╔══════════════════╗\n    🎉 𝐖𝐄𝐋𝐂𝐎𝐌𝐄 🎉\n╚══════════════════╝\n\n𝐇𝐞𝐥𝐥𝐨 " + toBoldFont(name) + "!\n\n📌 𝐂𝐨𝐦𝐦𝐚𝐧𝐝𝐬:\n✏️ /changename <name>\n📥 join\n📤 leave\n\n✅ 𝐘𝐨𝐮 𝐜𝐚𝐧 𝐜𝐡𝐚𝐧𝐠𝐞 𝐧𝐚𝐦𝐞 𝐚𝐧𝐲𝐭𝐢𝐦𝐞!\n\n𝐓𝐲𝐩𝐞 '𝐣𝐨𝐢𝐧' 𝐭𝐨 𝐞𝐧𝐭𝐞𝐫 𝐜𝐡𝐚𝐭.");
        } catch (err) {
            sendMessage(senderId, "❌ Error registering user.");
        }
        return;
    }

    const user = await User.findOne({ senderId });
    if (!user) {
        return sendMessage(senderId, "👋 𝐇𝐞𝐥𝐥𝐨! 𝐖𝐞𝐥𝐜𝐨𝐦𝐞 𝐭𝐨 𝐆𝐥𝐨𝐛𝐚𝐥 𝐂𝐡𝐚𝐭!\n\n⚠️ 𝐍𝐎𝐓𝐄: Space NOT allowed in name!\n📝 𝐓𝐲𝐩𝐞: /register YourName\n\nExample: /register Azuki");
    }

    // 2. CHANGE NAME COMMAND
    if (lowerText.startsWith("/changename ")) {
        const newName = text.slice(12).trim();
        
        if (newName.includes(" ")) {
            return sendMessage(senderId, "❌ 𝐄𝐫𝐫𝐨𝐫!\nSpace is not allowed in name!");
        }
        
        if (newName.length < 2 || newName.length > 10) {
            return sendMessage(senderId, "❌ 𝐈𝐧𝐯𝐚𝐥𝐢𝐝 𝐍𝐚𝐦𝐞!\nUse 2-10 characters only.");
        }

        try {
            const nameTaken = await User.findOne({ name: newName });
            if (nameTaken) {
                return sendMessage(senderId, "❌ 𝐒𝐨𝐫𝐫𝐲!\nName " + toBoldFont(newName) + " is already taken.");
            }

            await User.updateOne({ senderId }, { name: newName });
            sendMessage(senderId, "✅ 𝐍𝐚𝐦𝐞 𝐮𝐩𝐝𝐚𝐭𝐞𝐝 𝐭𝐨\n" + toBoldFont(newName));
        } catch (err) {
            sendMessage(senderId, "❌ Error changing name.");
        }
        return;
    }

    // 3. JOIN COMMAND
    if (lowerText === "join") {
        if (user.active) return sendMessage(senderId, "ℹ️ 𝐘𝐨𝐮 𝐚𝐫𝐞 𝐚𝐥𝐫𝐞𝐚𝐝𝐲 𝐢𝐧 𝐭𝐡𝐞 𝐜𝐡𝐚𝐭!");
        
        await User.updateOne({ senderId }, { active: true });
        
        broadcastSystem(toBoldFont(user.name) + " joined the chat.");
        sendMessage(senderId, "📥 𝐉𝐨𝐢𝐧𝐞𝐝 𝐬𝐮𝐜𝐜𝐞𝐬𝐬𝐟𝐮𝐥𝐥𝐲!\n𝐘𝐨𝐮 𝐜𝐚𝐧 𝐧𝐨𝐰 𝐭𝐚𝐥𝐤 𝐭𝐨 𝐬𝐭𝐫𝐚𝐧𝐠𝐞𝐫𝐬 𝐰𝐨𝐫𝐥𝐝𝐰𝐢𝐝𝐞.");
        return;
    }

    // 4. LEAVE COMMAND
    if (lowerText === "leave") {
        if (!user.active) return sendMessage(senderId, "ℹ️ 𝐘𝐨𝐮 𝐚𝐫𝐞 𝐧𝐨𝐭 𝐢𝐧 𝐭𝐡𝐞 𝐜𝐡𝐚𝐭.");
        
        await User.updateOne({ senderId }, { active: false });
        
        broadcastSystem(toBoldFont(user.name) + " left the chat.");
        sendMessage(senderId, "📤 𝐋𝐞𝐟𝐭 𝐭𝐡𝐞 𝐜𝐡𝐚𝐭.\n𝐓𝐲𝐩𝐞 '𝐣𝐨𝐢𝐧' 𝐚𝐧𝐲𝐭𝐢𝐦𝐞 𝐭𝐨 𝐜𝐨𝐦𝐞 𝐛𝐚𝐜𝐤.");
        return;
    }

    // 5. SEND MESSAGE TO GLOBAL CHAT
    if (user.active) {
        // CHECK IF REPLYING
        if (repliedToId) {
            const repliedUser = await User.findOne({ senderId: repliedToId });
            if (repliedUser) {
                // FORMAT: User1 replied to User2
                const output = `${toBoldFont(user.name)} replied to ${toBoldFont(repliedUser.name)}\n${text}`;
                // SEND TO EVERYONE EXCEPT ME
                const activeUsers = await User.find({ active: true, senderId: { $ne: senderId } });
                activeUsers.forEach(u => {
                    sendMessage(u.senderId, output);
                });
            }
        } else {
            // NORMAL MESSAGE
            const output = `${toBoldFont(user.name)}\n${text}`;
            const activeUsers = await User.find({ active: true, senderId: { $ne: senderId } });
            activeUsers.forEach(u => {
                sendMessage(u.senderId, output);
            });
        }
    } else {
        sendMessage(senderId, "🔒 𝐘𝐨𝐮 𝐚𝐫𝐞 𝐧𝐨𝐭 𝐢𝐧 𝐭𝐡𝐞 𝐜𝐡𝐚𝐭.\n𝐓𝐲𝐩𝐞 '𝐣𝐨𝐢𝐧' 𝐭𝐨 𝐩𝐚𝐫𝐭𝐢𝐜𝐢𝐩𝐚𝐭𝐞.");
    }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Send message to one person
function sendMessage(senderId, text) {
    text = text.replace(/\\n/g, '\n');

    const messageData = {
        recipient: { id: senderId },
        message: { text: text }
    };

    request({
        uri: "https://graph.facebook.com/v18.0/me/messages",
        qs: { access_token: PAGE_ACCESS_TOKEN },
        method: "POST",
        json: messageData
    }, (error, res, body) => {
        if (error) console.error("Send Error:", error);
    });
}

// Broadcast system notification
async function broadcastSystem(text) {
    const activeUsers = await User.find({ active: true });
    activeUsers.forEach(user => {
        sendMessage(user.senderId, text);
    });
}

// ==========================================
// START SERVER
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));
