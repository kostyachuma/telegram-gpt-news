const bot = require('../bot');
const User = require('../models/user');
const { sendProcessedNews, sendUserChannels } = require('../services/messageService');
const { handleError } = require('../utils/errorHandler');

const handlers = {
    '/scrape': async (chatId, channelUsername) => {
        bot.sendMessage(chatId, 'Обробка новин...');
        await sendProcessedNews(chatId, channelUsername);
        await sendUserChannels(chatId);
    },
    '/deletechannel': async (chatId) => {
        const user = await User.findOne({ chatId });
        if (!user || user.channels.length === 0) {
            bot.sendMessage(chatId, 'У вас немає доданих каналів.');
            return;
        }
        const deleteButtons = user.channels.map(channel => ([
            { text: channel, callback_data: `/confirmdelete ${channel}` }
        ]));
        bot.sendMessage(chatId, 'Виберіть канал для видалення:', {
            reply_markup: { inline_keyboard: deleteButtons }
        });
    },
    '/confirmdelete': async (chatId, channelUsername) => {
        const user = await User.findOne({ chatId });
        if (!user) return;
        user.channels = user.channels.filter(channel => channel !== channelUsername);
        await user.save();
        bot.sendMessage(chatId, `Канал ${channelUsername} успішно видалений.`);
        await sendUserChannels(chatId);
    },
    '/addchannel': (chatId) => {
        bot.sendVideo(chatId, 'add_chanel.mp4', {
            caption: '👆 Відео-інструкція\n\n🔁 Перешліть будь-яке повідомлення з каналу, який хочете додати. Канал з\'явиться у вашому списку ✅',
            reply_markup: {
                inline_keyboard: [[{ text: '🏠 Меню', callback_data: '/menu' }]]
            }
        });
    },
    '/compact': async (chatId) => {
        const user = await User.findOne({ chatId });
        if (!user) return;
        user.isCompact = !user.isCompact;
        await user.save();
        bot.sendMessage(chatId, `Режим компактності ${user.isCompact ? 'увімкнено' : 'вимкнено'}.`);
        await sendUserChannels(chatId);
    },
    '/menu': (chatId) => sendUserChannels(chatId)
};

async function handleCallbackQuery(callbackQuery) {
    const { message: { chat: { id: chatId } }, data: command } = callbackQuery;
    const [action, param] = command.split(' ');
    if (handlers[action]) {
        try {
            await handlers[action](chatId, param);
        } catch (error) {
            handleError(chatId, `Помилка при виконанні команди ${action}:`, error);
        }
    }
}

module.exports = {
    handleCallbackQuery
};
