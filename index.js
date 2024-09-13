require('./config'); // Подключение конфигурации и базы данных

const bot = require('./bot');
const { handleStartCommand, handleForwardedMessage } = require('./handlers/commandHandlers');
const { handlePreCheckoutQuery, handleSuccessfulPayment } = require('./handlers/paymentHandlers');
const { handleCallbackQuery } = require('./handlers/callbackHandlers');

bot.onText(/\/start/, handleStartCommand);
bot.on('message', handleForwardedMessage);
bot.on("pre_checkout_query", handlePreCheckoutQuery);
bot.on("successful_payment", handleSuccessfulPayment);
bot.on('callback_query', handleCallbackQuery);
