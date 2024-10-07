const bot = require('../bot');
const Channel = require('../models/channel');
const { findOrCreateUser } = require('../services/userService');
const { sendUserChannels } = require('../services/messageService');

async function handleStartCommand(msg) {
    const { chat: { id: chatId }, from: { username, first_name: firstName, last_name: lastName } } = msg;
    const user = await findOrCreateUser(chatId, { username, firstName, lastName });

    if (user) {
        await sendUserChannels(chatId);
    }
}

// Object for storing debounce timers
const debounceTimers = {};

// Debouncing function
function debounce(func, delay, key) {
    return (...args) => {
        if (debounceTimers[key]) {
            clearTimeout(debounceTimers[key]);
        }
        debounceTimers[key] = setTimeout(() => {
            func.apply(this, args);
            delete debounceTimers[key];
        }, delay);
    };
}

async function handleForwardedMessage(msg) {
    if (!msg.forward_from_chat) return;

    const { id, title, username, type } = msg.forward_from_chat;
    const chatId = msg.chat.id;

    // Create a unique key for debouncing
    const debounceKey = `${chatId}_${id}`;

    // Apply debouncing to the channel addition function
    const debouncedAddChannel = debounce(async () => {
        const user = await findOrCreateUser(chatId);
        if (!user) return;

        let channel = await Channel.findOne({ id });

        if (!channel) {
            channel = new Channel({
                id,
                title,
                username,
                type
            });
            await channel.save();
        }

        if (!user.channels.includes(channel._id)) {
            user.channels.push(channel._id);
            await user.save();
            bot.sendMessage(chatId, `Канал ${channel.title} успішно доданий.`);
        } else {
            bot.sendMessage(chatId, `Канал ${channel.title} вже доданий.`);
        }

        await sendUserChannels(chatId);
    }, 1000, debounceKey); // Delay of 1 second

    // Call the debounced function
    debouncedAddChannel();
}

module.exports = {
    handleStartCommand,
    handleForwardedMessage
};
