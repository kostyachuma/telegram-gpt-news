const mongoose = require('mongoose');

// Создание схемы и модели пользователя
const userSchema = new mongoose.Schema({
    chatId: { type: Number, required: true, unique: true },
    username: String,
    firstName: String,
    lastName: String,
    channels: [String], // Новое поле для хранения каналов
    requestCounter: { type: Array, default: [Date.now(), 0] }, // Счетчик запросов
    availableRequests: { type: Array, default: [Date.now(), 10] }, // Доступные запросы
});

const User = mongoose.model('User', userSchema);

module.exports = User;
