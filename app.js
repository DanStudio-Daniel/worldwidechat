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
    dbName: "strangerchat",
    useNewUrlParser: true,
    useUnifiedTopology: true
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
// FONT CONVERTER
// ==========================================
function toBoldFont(text) {
    const normal = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const bold   = "𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗";
    
    return text.split('').map(char => {
        const idx = normal.indexOf(char);
        return (idx !== -1) ? bold[idx] : char;
    }).join('');
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

            if (messageText) {
                handleMessage(senderId, messageText);
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
async function handleMessage(senderId, text) {
    const lowerText = text.toLowerCase().trim();

    // 1. REGISTER COMMAND
    if (lowerText.startsWith("/register ")) {
        const name = text.slice(10).trim();
        
        if (name.length < 2 || name.length > 10) {
            return sendMessage(senderId, "❌ Invalid name! Use 2-10 characters only.");
        }

        try {
            const existingUser = await User.findOne({ senderId });
            if (existingUser) {
                return sendMessage(senderId, "✅ You are already registered as " + toBoldFont(existingUser.name));
            }

            const newUser = new User({ senderId, name });
            await newUser.save();
            sendMessage(senderId, "🎉 Registration Successful!\nHello " + toBoldFont(name) + "!\nType 'join' to enter the Global Chat.");
        } catch (err) {
            sendMessage(senderId, "❌ Error registering user.");
        }
        return;
    }

    // Check if user exists
    const user = await User.findOne({ senderId });
    if (!user) {
        return sendMessage(senderId, "👋 Welcome!\nPlease register first:\nType /register <name>");
    }

    // 2. JOIN COMMAND
    if (lowerText === "join") {
        if (user.active) return sendMessage(senderId, "ℹ️ You are already in the chat!");
        
        await User.updateOne({ senderId }, { active: true });
        
        // System notification to everyone
        broadcastSystem(toBoldFont(user.name) + " joined the chat. ✅");
        sendMessage(senderId, "📥 You joined the Global Chat!\nYou can now talk to strangers worldwide.");
        return;
    }

    // 3. LEAVE COMMAND
    if (lowerText === "leave") {
        if (!user.active) return sendMessage(senderId, "ℹ️ You are not in the chat.");
        
        await User.updateOne({ senderId }, { active: false });
        
        // System notification to everyone
        broadcastSystem(toBoldFont(user.name) + " left the chat. ❌");
        sendMessage(senderId, "📤 You left the chat.\nType 'join' anytime to come back.");
        return;
    }

    // 4. SEND MESSAGE TO GLOBAL CHAT
    if (user.active) {
        broadcastMessage(user.name, text);
    } else {
        sendMessage(senderId, "🔒 You are not in the chat.\nType 'join' to participate.");
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

// Broadcast message to ALL active users
async function broadcastMessage(senderName, message) {
    const activeUsers = await User.find({ active: true });
    
    const formattedName = toBoldFont(senderName);
    const output = `${formattedName}\n${message}`;
    
    activeUsers.forEach(user => {
        sendMessage(user.senderId, output);
    });
}

// Broadcast system notification (Join/Leave)
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
            
