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
            'Поповнення балансу',
            `Поповніть баланс ⭐️ для продовження. Ви отримаєте ${amount} запитів`,
            'pay',
            '',
            'XTR',
            [{ label: 'Поповнення балансу', amount }]
        );

        throw new Error('Request limit exceeded');
    }

    if (Date.now() - timestamp < 10000) {
        bot.sendMessage(chatId, `Зачекайте ${10 - Math.floor((Date.now() - timestamp) / 1000)} секунд перед наступним запитом.`);
        throw new Error('Too many requests');
    }

    const summary = await processNews(posts, { isCompact: user.isCompact });

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
                        text: `👉 ${channel}`,
                        callback_data: `/scrape ${channel}`
                    }
                ]);
            });

            channelButtons.push([
                {
                    text: `${user.isCompact ? '✅' : '☑️'} Коротко`,
                    callback_data: '/compact'
                }
            ]);

            // Добавление кнопки "Удалить канал" только если есть каналы
            channelButtons.push([
                {
                    text: '+ Додати',
                    callback_data: '/addchannel'
                },
                {
                    text: '❌ Видалити',
                    callback_data: '/deletechannel'
                },
            ]);
        } else {
            bot.sendMessage(chatId, 'У вас немає доданих каналів.');
            // Добавление кнопки "Add" со смайликом
            channelButtons.push([{
                text: '+ Додати',
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

        bot.sendMessage(chatId, `<b>⭐️ ${availableRequests - requestCounter}</b> | Ваші канали:`, options);
    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, 'Сталася помилка при отриманні списку каналів.');
    }
}

// Обработка команд Telegram бота
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const { username, first_name: firstName, last_name: lastName } = msg.from;

    try {
        const user = new User({ chatId, username, firstName, lastName });
        await user.save();

        bot.sendMessage(chatId, 'Привіт! Я бот, який збирає останні пости з публічних каналів і обробляє їх за допомогою OpenAI. Щоб почати, додайте канали, які ви хочете відстежувати.');
    } catch (error) {
        if (error.code === 11000) {
            console.log('User already exists');
        } else {
            console.error('Error saving user:', error);
        }
    } finally {
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
        bot.sendMessage(chatId, 'Сталася помилка при обробці новин.');
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

        bot.sendMessage(msg.chat.id, 'Обробка новин...');

        try {
            await sendProcessedNews(msg.chat.id, channelUsername);
            await sendUserChannels(msg.chat.id);
        } catch (error) {
            console.error(error);
            bot.sendMessage(msg.chat.id, 'Сталася помилка при обробці новин.');
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

                bot.sendMessage(msg.chat.id, 'Виберіть канал для видалення:', options);
            } else {
                bot.sendMessage(msg.chat.id, 'У вас немає доданих каналів.');
            }
        } catch (error) {
            console.error(error);
            bot.sendMessage(msg.chat.id, 'Сталася помилка при отриманні списку каналів.');
        }
    } else if (command.startsWith('/confirmdelete ')) {
        const channelUsername = command.split(' ')[1];
        try {
            const user = await User.findOne({ chatId: msg.chat.id });
            if (user) {
                user.channels = user.channels.filter(channel => channel !== channelUsername);
                await user.save();
                bot.sendMessage(msg.chat.id, `Канал ${channelUsername} успішно видалений.`);
            } else {
                bot.sendMessage(msg.chat.id, 'Користувача не знайдено.');
            }
        } catch (error) {
            console.error(error);
            bot.sendMessage(msg.chat.id, 'Сталася помилка при видаленні каналу.');
        } finally {
            await sendUserChannels(msg.chat.id);
        }
    } else if (command === '/addchannel') {
        bot.sendMessage(msg.chat.id, 'Введіть username каналу (наприклад: @telegram, telegram) або посилання на канал (наприклад: https://t.me/telegram)');

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
                        bot.sendMessage(chatId, `Канал ${channelUsername} успішно доданий.`);
                    } else {
                        bot.sendMessage(chatId, `Канал ${channelUsername} вже доданий.`);
                    }
                } else {
                    bot.sendMessage(chatId, 'Користувача не знайдено.');
                }
            } catch (error) {
                console.error(error);
                bot.sendMessage(chatId, 'Сталася помилка при додаванні каналу.');
            } finally {
                await sendUserChannels(chatId);
            }
        });
    } else if (command === '/compact') {
        try {
            const user = await User.findOne({ chatId: msg.chat.id });

            user.isCompact = !user.isCompact;
            await user.save();

            bot.sendMessage(msg.chat.id, `Режим компактності ${user.isCompact ? 'увімкнено' : 'вимкнено'}.`);
        } catch (error) {
            console.error(error);
            bot.sendMessage(msg.chat.id, 'Сталася помилка при зміні режиму компактності.');
        } finally {
            await sendUserChannels(msg.chat.id);
        }
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
            throw new Error("Користувача не знайдено");
        }

        const [_availableTimestamp, availableRequests] = user.availableRequests;

        user.availableRequests = [Date.now(), availableRequests + ctx.successful_payment.total_amount];
        user.payments.push(ctx);

        await user.save();

        bot.sendMessage(ctx.chat.id, "Баланс поповнено. Дякуємо за підтримку!");
    } catch (error) {
        console.error("Помилка при збереженні оплаченого користувача:", error);
    } finally {
        await sendUserChannels(ctx.chat.id);
    }
});

module.exports = bot;
