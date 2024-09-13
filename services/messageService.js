const bot = require('../bot');
const User = require('../models/user');
const { scrapeChannel, processNews } = require('./scraper');
const { handleError } = require('../utils/errorHandler');

async function sendProcessedNews(chatId, channelUsername) {
    const user = await User.findOne({ chatId });
    if (!user) {
        handleError(chatId, 'Користувача не знайдено');
        return;
    }

    const [timestamp, requestCounter] = user.requestCounter;
    const [_availableTimestamp, availableRequests] = user.availableRequests;

    if (requestCounter >= availableRequests) {
        await bot.sendInvoice(chatId, 'Поповнення балансу', 
            `Поповніть баланс ⭐️ для продовження. Ви отримаєте 50 запитів`, 
            'pay', '', 'XTR', [{ label: 'Поповнення балансу', amount: 50 }]);
        return;
    }

    if (Date.now() - timestamp < 10000) {
        bot.sendMessage(chatId, `Зачекайте ${10 - Math.floor((Date.now() - timestamp) / 1000)} секунд перед наступним запитом.`);
        return;
    }

    const posts = await scrapeChannel(channelUsername);
    if (posts.length === 0) {
        console.log('No new posts today.');
        return;
    }

    const summary = await processNews(posts, { isCompact: user.isCompact });
    user.requestCounter = [Date.now(), requestCounter + 1];
    await user.save();

    bot.sendMessage(chatId, summary, { parse_mode: 'HTML' });
}

async function sendUserChannels(chatId) {
    try {
        const user = await User.findOne({ chatId });
        if (!user) {
            bot.sendMessage(chatId, 'Користувача не знайдено.');
            return;
        }

        const channelButtons = user.channels.map(channel => ([
            { text: `👉 ${channel}`, callback_data: `/scrape ${channel}` }
        ]));

        channelButtons.push([{ text: `${user.isCompact ? '✅' : '☑️'} Коротко`, callback_data: '/compact' }]);
        channelButtons.push([
            { text: '+ Додати', callback_data: '/addchannel' },
            { text: '❌ Видалити', callback_data: '/deletechannel' },
        ]);

        const options = {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: channelButtons }
        };

        const [_timestamp, requestCounter] = user.requestCounter;
        const [_availableTimestamp, availableRequests] = user.availableRequests;

        bot.sendMessage(chatId, `<b>⭐️ ${availableRequests - requestCounter}</b> | Ваші канали:`, options);
    } catch (error) {
        handleError(chatId, 'Помилка при отриманні списку каналів:', error);
    }
}

module.exports = {
    sendProcessedNews,
    sendUserChannels
};
