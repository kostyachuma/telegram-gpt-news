const mongoose = require('mongoose');

// Создание схемы и модели пользователя
const userSchema = new mongoose.Schema({
    // user
    chatId: { type: Number, required: true, unique: true },
    username: String,
    firstName: String,
    lastName: String,

    // data
    channels: { type: Array, default: ['telegram', 'durov'] },
    requestCounter: { type: Array, default: [Date.now(), 0] },
    availableRequests: { type: Array, default: [Date.now(), 50] },
    payments: { type: Array, default: [] },

    // settings
    isCompact: { type: Boolean, default: false },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
