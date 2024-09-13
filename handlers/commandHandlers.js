const bot = require('../bot');
const { findOrCreateUser } = require('../services/userService');
const { sendUserChannels } = require('../services/messageService');

async function handleStartCommand(msg) {
    const { chat: { id: chatId }, from: { username, first_name: firstName, last_name: lastName } } = msg;
    const user = await findOrCreateUser(chatId, { username, firstName, lastName });
    if (user) {
        bot.sendMessage(chatId, 'Привіт! Я бот, який збирає останні пости з публічних каналів і обробляє їх за допомогою OpenAI. Щоб почати, додайте канали, які ви хочете відстежувати.');
        await sendUserChannels(chatId);
    }
}

async function handleForwardedMessage(msg) {
    if (!msg.forward_from_chat) return;

    const channelUsername = msg.forward_from_chat.username || msg.forward_from_chat.id;
    const chatId = msg.chat.id;
    const user = await findOrCreateUser(chatId);

    if (!user) return;

    if (!user.channels.includes(channelUsername)) {
        user.channels.push(channelUsername);
        await user.save();
        bot.sendMessage(chatId, `Канал ${channelUsername} успішно доданий.`);
    } else {
        bot.sendMessage(chatId, `Канал ${channelUsername} вже доданий.`);
    }

    await sendUserChannels(chatId);
}

module.exports = {
    handleStartCommand,
    handleForwardedMessage
};
