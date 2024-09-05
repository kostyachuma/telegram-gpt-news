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

    const user = await User.findOne({ chatId });

    const [timestamp, requestCounter] = user.requestCounter;
    const [_availableTimestamp, availableRequests] = user.availableRequests;

    if (requestCounter >= availableRequests) {
      const amount = 50;
      await bot.sendInvoice(
          chatId,
          'Пополнение баланса',
          `Пополните баланс ⭐️ для продолжения. Вы получите ${amount} запросов`,
          'pay',
          '',
          'XTR',
          [{ label: 'Пополнение баланса', amount }]
      )

      // console.log('Invoice response:', response);
      throw new Error('Request limit exceeded');
    }

    if (Date.now() - timestamp < 30000) {
      bot.sendMessage(chatId, `Подождите ${30 - Math.floor((Date.now() - timestamp) / 1000)} секунд перед следующим запросом.`);
      throw new Error('Too many requests');
    }

    const summary = await processNews(posts);

    user.requestCounter = [Date.now(), requestCounter + 1];
    await user.save();

    bot.sendMessage(chatId, summary, { parse_mode: 'HTML' });
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
                        text: `🟢 ${channel}`,
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
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: channelButtons
            }
        };

        const [_timestamp, requestCounter] = user.requestCounter;
        const [_availableTimestamp, availableRequests] = user.availableRequests;

        // console.log('Request counter:', requestCounter);
        // console.log('Available requests:', availableRequests);

        bot.sendMessage(chatId, `<b>⭐️ ${availableRequests - requestCounter}</b> \nВаши каналы:`, options);
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
        bot.sendMessage(chatId, 'Привет! Я бот, который собирает последние посты из публичных каналов и обрабатывает их с помощью OpenAI. Для начала добавьте каналы, которые вы хотите отслеживать.');
    } catch (error) {
        if (error.code === 11000) {
            console.log('User already exists');
        } else {
            console.error('Error saving user:', error);
        }
    } finally {
        // Отображение списка каналов пользователя
        await sendUserChannels(chatId);
    }
});

bot.onText(/\/scrape (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const channelUsername = match[1];

    try {
        await sendProcessedNews(chatId, channelUsername);
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

        bot.sendMessage(msg.chat.id, 'Обработка новостей...');

        try {
            await sendProcessedNews(msg.chat.id, channelUsername);
            await sendUserChannels(msg.chat.id);
        } catch (error) {
            console.error(error);
            bot.sendMessage(msg.chat.id, 'Произошла ошибка при обработке новостей.');
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
            const channelUsername = responseMsg.text.includes('http')
                ? responseMsg.text.split('/').pop()
                : responseMsg.text.replace('@', '');
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

bot.on("pre_checkout_query", async (ctx) => {
    try {
        await bot.answerPreCheckoutQuery(ctx.id, true);
    } catch (error) {
        console.error("answerPreCheckoutQuery failed");
    }
});

bot.on("successful_payment", async (ctx) => {
    if (!ctx?.successful_payment || !ctx?.from || !ctx?.chat) {
        return;
    }

    try {
        const user = await User.findOne({ chatId: ctx.chat.id });

        if (!user) {
            throw new Error("User not found");
        }

        const [_availableTimestamp, availableRequests] = user.availableRequests;

        user.availableRequests = [Date.now(), availableRequests + ctx.successful_payment.total_amount];
        user.payments.push(ctx);

        await user.save();

        bot.sendMessage(ctx.chat.id, "Баланс пополнен. Спасибо за поддержку!");
    } catch (error) {
        console.error("Error saving paid user:", error);
    } finally {
        await sendUserChannels(ctx.chat.id);
    }
});

module.exports = bot;
