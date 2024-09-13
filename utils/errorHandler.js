const bot = require('../bot');

function handleError(chatId, message, error) {
    console.error(message, error);
    bot.sendMessage(chatId, 'Сталася помилка. Спробуйте ще раз пізніше.');
}

module.exports = {
    handleError
};
