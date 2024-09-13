const TelegramBot = require('node-telegram-bot-api');
const { TELEGRAM_TOKEN } = require('./config');

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

module.exports = bot;
