const { parsed: { TELEGRAM_TOKEN, OPENAI_API_KEY }, } = require("dotenv").config();

const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');
const { telegram_scraper } = require('telegram-scraper')

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  organization: "org-SNusdhS498hKWtZwQ1hljxUC",
});

// Функция для скрапинга постов из канала
async function scrapeChannel(channelUsername) {
    const posts = await telegram_scraper(channelUsername)

    return JSON.parse(posts).map(({ message_text }) => message_text);
}

// Функция для обработки новостей через OpenAI
async function processNews(posts) {
    const content = `Подведи итог новостей за день, добавь эмоджи, называй меня чувачек: ${posts.join('\n')}`;

    const response = await openai.chat.completions.create({
        messages: [{ role: 'user', content }],
        model: 'gpt-4o-mini',
    })

    return response.choices[0].message.content;
}

// Функция для отправки обработанных новостей пользователям
async function sendProcessedNews(chatId, channelUsername) {
    const posts = await scrapeChannel(channelUsername);

    if (posts.length === 0) {
        console.log('No new posts today.');
        return;
    }

    const summary = await processNews(posts);

    // Здесь добавьте логику отправки резюме пользователям
    bot.sendMessage(chatId, summary);
}

// Обработка команд Telegram бота
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Привет! Я бот, который собирает новости и делает их обзор.');
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
    }
});
