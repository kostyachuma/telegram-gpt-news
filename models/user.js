const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    chatId: { type: Number, required: true, unique: true },
    username: String,
    firstName: String,
    lastName: String,
    channels: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Channel' }],
    requestCounter: { type: Array, default: [Date.now(), 0] },
    availableRequests: { type: Array, default: [Date.now(), 50] },
    payments: { type: Array, default: [] },
    isCompact: { type: Boolean, default: false },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

module.exports = User;
