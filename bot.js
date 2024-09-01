const TelegramBot = require('node-telegram-bot-api');
const User = require('./models/user');
const { scrapeChannel, processNews } = require('./services/scraper');
const { TELEGRAM_TOKEN } = require('./config');

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Функция для отправки обработанных новостей пользователям
async function sendProcessedNews(chatId, channelUsername) {
    const posts = await scrapeChannel(channelUsername);

    if (posts.length === 0) {
        console.log('No new posts today.');
        return;
    }

    const summary = await processNews(posts);
    bot.sendMessage(chatId, summary);
}

// Функция для отправки списка каналов пользователю
async function sendUserChannels(chatId) {
    try {
        const user = await User.findOne({ chatId });
        const channelButtons = [];

        if (user && user.channels.length > 0) {
            user.channels.forEach(channel => {
                channelButtons.push([
                    {
                        text: channel,
                        callback_data: `/scrape ${channel}`
                    }
                ]);
            });

            // Добавление кнопки "Удалить канал" только если есть каналы
            channelButtons.push([
                {
                    text: 'Add ➕',
                    callback_data: '/addchannel'
                },
                {
                    text: 'Delete ❌',
                    callback_data: '/deletechannel'
                },
            ]);
        } else {
            bot.sendMessage(chatId, 'У вас нет добавленных каналов.');
            // Добавление кнопки "Add" со смайликом
            channelButtons.push([{
                text: 'Add ➕',
                callback_data: '/addchannel'
            }]);
        }

        const options = {
            reply_markup: {
                inline_keyboard: channelButtons
            }
        };

        bot.sendMessage(chatId, 'Ваши каналы:', options);
    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, 'Произошла ошибка при получении списка каналов.');
    }
}

// Обработка команд Telegram бота
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const { username, first_name: firstName, last_name: lastName } = msg.from;

    // Сохранение пользователя в базу данных
    try {
        const user = new User({ chatId, username, firstName, lastName });
        await user.save();
        console.log('User saved:', user);
    } catch (error) {
        if (error.code === 11000) {
            console.log('User already exists');
        } else {
            console.error('Error saving user:', error);
        }

    } finally {
        bot.sendMessage(chatId, 'Привет! Я бот, который собирает новости и делает их обзор.');
        // Отображение списка каналов пользователя
        await sendUserChannels(chatId);
    }
});

bot.onText(/\/scrape (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const channelUsername = match[1];

    try {
        await sendProcessedNews(chatId, channelUsername);
        bot.sendMessage(chatId, 'Новости успешно обработаны и отправлены.');
    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, 'Произошла ошибка при обработке новостей.');
    } finally {
        await sendUserChannels(chatId);
    }
});

// Обработка нажатий на кнопки
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const command = callbackQuery.data;

    if (command.startsWith('/scrape ')) {
        const channelUsername = command.split(' ')[1];
        try {
            await sendProcessedNews(msg.chat.id, channelUsername);
            bot.sendMessage(msg.chat.id, 'Новости успешно обработаны и отправлены.');
        } catch (error) {
            console.error(error);
            bot.sendMessage(msg.chat.id, 'Произошла ошибка при обработке новостей.');
        } finally {
            await sendUserChannels(msg.chat.id);
        }
    } else if (command === '/deletechannel') {
        try {
            const user = await User.findOne({ chatId: msg.chat.id });
            if (user && user.channels.length > 0) {
                const deleteButtons = user.channels.map(channel => ([
                    {
                        text: channel,
                        callback_data: `/confirmdelete ${channel}`
                    }
                ]));

                const options = {
                    reply_markup: {
                        inline_keyboard: deleteButtons
                    }
                };

                bot.sendMessage(msg.chat.id, 'Выберите канал для удаления:', options);
            } else {
                bot.sendMessage(msg.chat.id, 'У вас нет добавленных каналов.');
            }
        } catch (error) {
            console.error(error);
            bot.sendMessage(msg.chat.id, 'Произошла ошибка при получении списка каналов.');
        }
    } else if (command.startsWith('/confirmdelete ')) {
        const channelUsername = command.split(' ')[1];
        try {
            const user = await User.findOne({ chatId: msg.chat.id });
            if (user) {
                user.channels = user.channels.filter(channel => channel !== channelUsername);
                await user.save();
                bot.sendMessage(msg.chat.id, `Канал ${channelUsername} успешно удален.`);
            } else {
                bot.sendMessage(msg.chat.id, 'Пользователь не найден.');
            }
        } catch (error) {
            console.error(error);
            bot.sendMessage(msg.chat.id, 'Произошла ошибка при удалении канала.');
        } finally {
            await sendUserChannels(msg.chat.id);
        }
    } else if (command === '/addchannel') {
        bot.sendMessage(msg.chat.id, 'Введите имя канала, который вы хотите добавить:');
        
        bot.once('message', async (responseMsg) => {
            const channelUsername = responseMsg.text;
            const chatId = responseMsg.chat.id;

            try {
                const user = await User.findOne({ chatId });
                if (user) {
                    if (!user.channels.includes(channelUsername)) {
                        user.channels.push(channelUsername);
                        await user.save();
                        bot.sendMessage(chatId, `Канал ${channelUsername} успешно добавлен.`);
                    } else {
                        bot.sendMessage(chatId, `Канал ${channelUsername} уже добавлен.`);
                    }
                } else {
                    bot.sendMessage(chatId, 'Пользователь не найден.');
                }
            } catch (error) {
                console.error(error);
                bot.sendMessage(chatId, 'Произошла ошибка при добавлении канала.');
            } finally {
                await sendUserChannels(chatId);
            }
        });
    }
});

module.exports = bot;
