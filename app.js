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
    active: { type: Boolean, default: false },
    currentGroupId: { type: String, default: null },
    setupState: { type: String, default: null },
    tempGroupData: { type: Object, default: {} }
});
const User = mongoose.model("globalusers", userSchema);

const groupSchema = new mongoose.Schema({
    groupId: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true },
    name: { type: String, required: true },
    visibility: { type: String, enum: ['public', 'private'], default: 'public' },
    maxUsers: { type: Number, default: 100 },
    bannedUsers: { type: [String], default: [] } 
});
const Group = mongoose.model("groups", groupSchema);

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
    } else { res.sendStatus(403); }
});

app.post("/webhook", (req, res) => {
    const body = req.body;
    if (body.object === "page") {
        body.entry.forEach(entry => {
            const webhookEvent = entry.messaging[0];
            const senderId = webhookEvent.sender.id;
            sendReadReceipt(senderId);
            const messageText = webhookEvent.message?.text;
            let replyToMid = webhookEvent.message?.reply_to?.mid || null;
            if (messageText) { handleMessage(senderId, messageText, replyToMid); }
        });
        res.status(200).send("EVENT_RECEIVED");
    } else { res.sendStatus(404); }
});

// ==========================================
// MAIN LOGIC
// ==========================================
async function handleMessage(senderId, text, replyToMid) {
    const lowerText = text.toLowerCase().trim();
    const alphaNumeric = /^[a-zA-Z0-9]+$/;

    // 1. REGISTRATION
    if (lowerText.startsWith("/register")) {
        const name = text.slice(10).trim();
        if (!name) return sendMessage(senderId, "⚠️ 𝐏𝐥𝐞𝐚𝐬𝐞 𝐞𝐧𝐭𝐞𝐫 𝐚 𝐧𝐚𝐦𝐞!\nExample: /register Azuki");
        if (!alphaNumeric.test(name)) return sendMessage(senderId, "❌ 𝐒𝐲𝐦𝐛𝐨𝐥𝐬 𝐧𝐨𝐭 𝐚𝐥𝐥𝐨𝐰𝐞𝐝!");
        const existing = await User.findOne({ senderId });
        if (existing) return sendMessage(senderId, "✅ 𝐀𝐥𝐫𝐞𝐚𝐝𝐲 𝐫𝐞𝐠𝐢𝐬𝐭𝐞𝐫𝐞𝐝: " + toBoldFont(existing.name));
        await new User({ senderId, name }).save();
        return sendMessage(senderId, "──────────────────\n    🎉 𝐖𝐄𝐋𝐂𝐎𝐌𝐄 🎉\n──────────────────\n\n𝐇𝐞𝐥𝐥𝐨 " + toBoldFont(name) + "!\n\n📌 𝐂𝐨𝐦𝐦𝐚𝐧𝐝𝐬:\n✏️ /changename <name>\n📥 join\n📤 leave\n🔨 creategroup\n\n✅ 𝐘𝐨𝐮 𝐜𝐚𝐧 𝐜𝐡𝐚𝐧𝐠𝐞 𝐧𝐚𝐦𝐞 𝐚𝐧𝐲𝐭𝐢𝐦𝐞!\n\n𝐓𝐲𝐩𝐞 '𝐣𝐨𝐢𝐧' 𝐭𝐨 𝐞𝐧𝐭𝐞𝐫 𝐜𝐡𝐚𝐭.");
    }

    const user = await User.findOne({ senderId });
    if (!user) return sendMessage(senderId, "👋 Type: /register YourName");

    // 2. CREATOR COMMANDS (/kick, /ban, /unban)
    if (user.currentGroupId && (lowerText.startsWith("/kick ") || lowerText.startsWith("/ban ") || lowerText.startsWith("/unban "))) {
        const group = await Group.findOne({ groupId: user.currentGroupId });
        if (group.ownerId !== senderId) return sendMessage(senderId, "❌ Only the group creator can use this.");

        const targetName = text.split(" ")[1];
        const targetUser = await User.findOne({ name: targetName, currentGroupId: group.groupId });

        if (lowerText.startsWith("/kick")) {
            if (!targetUser) return sendMessage(senderId, "❌ User not found in group.");
            await User.updateOne({ senderId: targetUser.senderId }, { currentGroupId: null, active: false });
            sendMessage(targetUser.senderId, "⚠️ You have been kicked from the group.");
            return broadcastGroup(group.groupId, `🚫 ${toBoldFont(targetUser.name)} was kicked by the Creator.`);
        }

        if (lowerText.startsWith("/ban")) {
            if (!targetUser) return sendMessage(senderId, "❌ User not found in group.");
            await Group.updateOne({ groupId: group.groupId }, { $addToSet: { bannedUsers: targetUser.senderId } });
            await User.updateOne({ senderId: targetUser.senderId }, { currentGroupId: null, active: false });
            sendMessage(targetUser.senderId, "🚫 You have been banned from this group.");
            return broadcastGroup(group.groupId, `🔨 ${toBoldFont(targetUser.name)} was banned by the Creator.`);
        }

        if (lowerText.startsWith("/unban")) {
            const bannedUser = await User.findOne({ name: targetName });
            if (!bannedUser) return sendMessage(senderId, "❌ User not found.");
            await Group.updateOne({ groupId: group.groupId }, { $pull: { bannedUsers: bannedUser.senderId } });
            return sendMessage(senderId, `✅ ${toBoldFont(bannedUser.name)} has been unbanned.`);
        }
    }

    // 3. CHANGE NAME
    if (lowerText.startsWith("/changename")) {
        const newName = text.slice(12).trim();
        if (!newName || !alphaNumeric.test(newName)) return sendMessage(senderId, "❌ Use letters and numbers only.");
        const nameTaken = await User.findOne({ name: newName });
        if (nameTaken) return sendMessage(senderId, "❌ 𝐍𝐚𝐦𝐞 𝐭𝐚𝐤𝐞𝐧!");
        await User.updateOne({ senderId }, { name: newName });
        return sendMessage(senderId, "✅ 𝐍𝐚𝐦𝐞 𝐮𝐩𝐝𝐚𝐭𝐞𝐝: " + toBoldFont(newName));
    }

    // 4. GROUP CREATION
    if (lowerText === "creategroup" || user.setupState) {
        if (lowerText === "creategroup") {
            const oldGroup = await Group.findOne({ ownerId: senderId });
            if (oldGroup) {
                await Group.deleteOne({ groupId: oldGroup.groupId });
                await User.updateMany({ currentGroupId: oldGroup.groupId }, { currentGroupId: null, active: false });
            }
            await User.updateOne({ senderId }, { setupState: "WAITING_NAME", tempGroupData: {} });
            return sendMessage(senderId, "──────────────────\n   🆕 𝐂𝐑𝐄𝐀𝐓𝐄 𝐆𝐑𝐎𝐔𝐏\n──────────────────\n\n𝐏𝐥𝐞𝐚𝐬𝐞 𝐞𝐧𝐭𝐞𝐫 𝐠𝐫𝐨𝐮𝐩 𝐧𝐚𝐦𝐞:");
        }
        if (user.setupState === "WAITING_NAME") {
            if (!alphaNumeric.test(text) || text.length < 2 || text.length > 20) return sendMessage(senderId, "❌ 2-20 letters/numbers only.");
            await User.updateOne({ senderId }, { setupState: "WAITING_VIS", "tempGroupData.name": text });
            return sendMessage(senderId, "👁️ 𝐕𝐢𝐬𝐢𝐛𝐢𝐥𝐢𝐭𝐲: (public / private)");
        }
        if (user.setupState === "WAITING_VIS") {
            if (lowerText !== "private" && lowerText !== "public") return sendMessage(senderId, "❌ Type 'private' or 'public'.");
            await User.updateOne({ senderId }, { setupState: "WAITING_MAX", "tempGroupData.visibility": lowerText });
            return sendMessage(senderId, "👥 𝐌𝐚𝐱 𝐮𝐬𝐞𝐫𝐬: (min 100)");
        }
        if (user.setupState === "WAITING_MAX") {
            const max = parseInt(text);
            if (isNaN(max) || max < 100) return sendMessage(senderId, "❌ Minimum 100.");
            let newId = Math.floor(10000 + Math.random() * 90000).toString();
            const newGroup = new Group({ groupId: newId, ownerId: senderId, name: user.tempGroupData.name, visibility: user.tempGroupData.visibility, maxUsers: max });
            await newGroup.save();
            await User.updateOne({ senderId }, { setupState: null, tempGroupData: {}, currentGroupId: newId, active: true });
            return sendMessage(senderId, `──────────────────\n   ✅ 𝐆𝐑𝐎𝐔𝐏 𝐑𝐄𝐀𝐃𝐘\n──────────────────\n\n𝐍𝐚𝐦𝐞: ${toBoldFont(newGroup.name)}\n𝐈𝐃: ${newId}\n𝐎𝐧𝐥𝐢𝐧𝐞 𝟏/${max}\n\n👑 𝐘𝐨𝐮 𝐚𝐫𝐞 𝐭𝐡𝐞 𝐂𝐫𝐞𝐚𝐭𝐨𝐫!\n/kick [name]\n/ban [name]\n/unban [name]`);
        }
    }

    // 5. JOIN/LEAVE
    if (lowerText === "join" || lowerText.startsWith("join ")) {
        if (lowerText === "join") {
            const publics = await Group.find({ visibility: "public" });
            let list = "📂 𝐏𝐮𝐛𝐥𝐢𝐜 𝐆𝐫𝐨𝐮𝐩𝐬:\n";
            for (let g of publics) {
                const onlineCount = await User.countDocuments({ currentGroupId: g.groupId });
                list += `• ${toBoldFont(g.name)} - ${g.groupId} (${onlineCount}/${g.maxUsers})\n`;
            }
            return sendMessage(senderId, list + "\nType: join [id]");
        }
        const targetId = text.split(" ")[1];
        const group = await Group.findOne({ groupId: targetId });
        if (!group) return sendMessage(senderId, "❌ ID not found.");
        if (group.bannedUsers.includes(senderId)) return sendMessage(senderId, "❌ You are banned from this group.");
        
        const onlineCount = await User.countDocuments({ currentGroupId: targetId });
        if (onlineCount >= group.maxUsers) return sendMessage(senderId, "❌ Group is full!");

        await User.updateOne({ senderId }, { currentGroupId: targetId, active: true });
        const newCount = onlineCount + 1;
        
        const welcomeHeader = `📥 𝐖𝐞𝐥𝐜𝐨𝐦𝐞 𝐭𝐨 ${toBoldFont(group.name)} 𝐠𝐫𝐨𝐮𝐩!\n𝐎𝐧𝐥𝐢𝐧𝐞 ${newCount}/${group.maxUsers}`;
        
        if (group.ownerId === senderId) {
            sendMessage(senderId, `${welcomeHeader}\n──────────────────\n👑 𝐆𝐑𝐎𝐔𝐏 𝐌𝐀𝐍𝐀𝐆𝐄𝐌𝐄𝐍𝐓\n──────────────────\n/kick [name]\n/ban [name]\n/unban [name]`);
        } else {
            sendMessage(senderId, welcomeHeader);
        }
        
        return broadcastGroup(targetId, `${toBoldFont(user.name)} joined the chat!`, senderId);
    }

    if (lowerText === "leave") {
        if (!user.currentGroupId) return sendMessage(senderId, "ℹ️ No group.");
        const gid = user.currentGroupId;
        await User.updateOne({ senderId }, { currentGroupId: null, active: false });
        sendMessage(senderId, "📤 𝐋𝐞𝐟𝐭 𝐭𝐡𝐞 𝐜𝐡𝐚𝐭.");
        return broadcastGroup(gid, `${toBoldFont(user.name)} left the chat.`, null);
    }

    // 6. CHAT
    if (user.active && user.currentGroupId) {
        const group = await Group.findOne({ groupId: user.currentGroupId });
        const isOwner = group.ownerId === senderId;
        let displayName = toBoldFont(user.name) + (isOwner ? " 👑" : "");

        let header = displayName;
        if (replyToMid) {
            const original = await MessageLog.findOne({ mid: replyToMid });
            header = original ? `${displayName} replied to ${toBoldFont(original.senderName)}` : `${displayName} replied to System`;
        }
        const output = `${header}\n${text}`;
        const members = await User.find({ currentGroupId: user.currentGroupId, senderId: { $ne: senderId } });
        members.forEach(m => sendAndLogMessage(m.senderId, output, user.name));
    } else if (!user.setupState) {
        sendMessage(senderId, "──────────────────\n         💡 𝐓𝐈𝐏\n──────────────────\n\n𝐍𝐨𝐭 𝐢𝐧 𝐚 𝐠𝐫𝐨𝐮𝐩! 𝐓𝐲𝐩𝐞 '𝐣𝐨𝐢𝐧' 𝐭𝐨 𝐬𝐞𝐞 𝐚𝐯𝐚𝐢𝐥𝐚𝐛𝐥𝐞 𝐠𝐫𝐨𝐮𝐩𝐬\n\n𝐎𝐫 𝐜𝐫𝐞𝐚𝐭𝐞 𝐲𝐨𝐮𝐫 𝐨𝐰𝐧 𝐠𝐫𝐨𝐮𝐩 𝐣𝐮𝐬𝐭 𝐭𝐲𝐩𝐞 '𝐜𝐫𝐞𝐚𝐭𝐞𝐠𝐫𝐨𝐮𝐩'");
    }
}

// ==========================================
// HELPERS
// ==========================================
function sendReadReceipt(senderId) {
    request({ uri: "https://graph.facebook.com/v18.0/me/messages", qs: { access_token: PAGE_ACCESS_TOKEN }, method: "POST", json: { recipient: { id: senderId }, sender_action: "mark_seen" } });
}
function sendMessage(senderId, text) {
    request({ uri: "https://graph.facebook.com/v18.0/me/messages", qs: { access_token: PAGE_ACCESS_TOKEN }, method: "POST", json: { recipient: { id: senderId }, message: { text: text } } });
}
function sendAndLogMessage(recipientId, text, senderName) {
    request({ uri: "https://graph.facebook.com/v18.0/me/messages", qs: { access_token: PAGE_ACCESS_TOKEN }, method: "POST", json: { recipient: { id: recipientId }, message: { text: text } } }, 
    async (err, res, body) => { if (body?.message_id) await new MessageLog({ mid: body.message_id, senderName }).save(); });
}
async function broadcastGroup(groupId, text, skipId) {
    const members = await User.find({ currentGroupId: groupId });
    members.forEach(m => { if (m.senderId !== skipId) sendMessage(m.senderId, text); });
}

app.listen(process.env.PORT || 3000);
