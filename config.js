const { parsed: { TELEGRAM_TOKEN, OPENAI_API_KEY, OPENAI_ORGANIZATION, MONGODB_URI } } = require("dotenv").config();

const mongoose = require('mongoose');

// Подключение к MongoDB
mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

module.exports = { TELEGRAM_TOKEN, OPENAI_API_KEY, OPENAI_ORGANIZATION };
