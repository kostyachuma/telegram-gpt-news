const mongoose = require('mongoose');

// Создание схемы и модели пользователя
const userSchema = new mongoose.Schema({
    chatId: { type: Number, required: true, unique: true },
    username: String,
    firstName: String,
    lastName: String,
    channels: [String], // Новое поле для хранения каналов
});

const User = mongoose.model('User', userSchema);

module.exports = User;
