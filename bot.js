const TelegramBot = require('node-telegram-bot-api');
const User = require('./models/user');
const { scrapeChannel, processNews } = require('./services/scraper');
const { TELEGRAM_TOKEN } = require('./config');

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Централізована обробка помилок
function handleError(chatId, message, error) {
    console.error(message, error);
    bot.sendMessage(chatId, 'Сталася помилка. Спробуйте ще раз пізніше.');
}

// Функція для пошуку або створення користувача
async function findOrCreateUser(chatId, userData = {}) {
    try {
        let user = await User.findOne({ chatId });
        if (!user) {
            user = new User({ chatId, ...userData });
            await user.save();
        }
        return user;
    } catch (error) {
        handleError(chatId, 'Помилка при пошуку або створенні користувача:', error);
        return null;
    }
}

// Оптимізована функція handleStartCommand
async function handleStartCommand(msg) {
    const { chat: { id: chatId }, from: { username, first_name: firstName, last_name: lastName } } = msg;
    const user = await findOrCreateUser(chatId, { username, firstName, lastName });
    if (user) {
        bot.sendMessage(chatId, 'Привіт! Я бот, який збирає останні пости з публічних каналів і обробляє їх за допомогою OpenAI. Щоб почати, додайте канали, які ви хочете відстежувати.');
        await sendUserChannels(chatId);
    }
}

// Оптимізована функція handleForwardedMessage
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

// Function to handle pre-checkout query
async function handlePreCheckoutQuery(ctx) {
    try {
        await bot.answerPreCheckoutQuery(ctx.id, true);
    } catch (error) {
        console.error("answerPreCheckoutQuery failed");
    }
}

// Function to handle successful payment
async function handleSuccessfulPayment(ctx) {
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
}

// Function to send processed news to users
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

// Function to send the list of channels to the user
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

bot.onText(/\/start/, handleStartCommand);
bot.on('message', handleForwardedMessage);
bot.on("pre_checkout_query", handlePreCheckoutQuery);
bot.on("successful_payment", handleSuccessfulPayment);

// Обработка нажатий на кнопки
bot.on('callback_query', async (callbackQuery) => {
    const { message: { chat: { id: chatId } }, data: command } = callbackQuery;

    const handlers = {
        '/scrape': async (channelUsername) => {
            bot.sendMessage(chatId, 'Обробка новин...');

            await sendProcessedNews(chatId, channelUsername);
            await sendUserChannels(chatId);
        },
        '/deletechannel': async () => {
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
        '/confirmdelete': async (channelUsername) => {
            const user = await User.findOne({ chatId });

            if (!user) return;

            user.channels = user.channels.filter(channel => channel !== channelUsername);
            await user.save();

            bot.sendMessage(chatId, `Канал ${channelUsername} успішно видалений.`);
            await sendUserChannels(chatId);
        },
        '/addchannel': () => {
            bot.sendVideo(chatId, 'add_chanel.mp4', {
                caption: '👆 Відео-інструкція\n\n🔁 Перешліть будь-яке повідомлення з каналу, який хочете додати. Канал з\'явиться у вашому списку ✅',
                reply_markup: {
                    inline_keyboard: [[{ text: '🏠 Меню', callback_data: '/menu' }]]
                }
            });
        },
        '/compact': async () => {
            const user = await User.findOne({ chatId });

            if (!user) return;

            user.isCompact = !user.isCompact;
            await user.save();

            bot.sendMessage(chatId, `Режим компактності ${user.isCompact ? 'увімкнено' : 'вимкнено'}.`);
            await sendUserChannels(chatId);
        },
        '/menu': () => sendUserChannels(chatId)
    };

    const [action, param] = command.split(' ');

    if (handlers[action]) {
        try {
            await handlers[action](param);
        } catch (error) {
            handleError(chatId, `Помилка при виконанні команди ${action}:`, error);
        }
    }
});

module.exports = bot;
