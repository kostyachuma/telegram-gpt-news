const OpenAI = require('openai');
const { telegram_scraper } = require('telegram-scraper');
const { OPENAI_API_KEY, OPENAI_ORGANIZATION } = require('../config');

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  organization: OPENAI_ORGANIZATION,
});

// Функция для скрапинга постов из канала
async function scrapeChannel(channelUsername) {
    const posts = await telegram_scraper(channelUsername);
    return JSON.parse(posts).map(({ message_text }) => message_text);
}

// Функция для обработки новостей через OpenAI
async function processNews(posts) {
    const content = `Подведи итог новостей за день, добавь эмоджи, ты пацан с района, называй меня чувачек: ${posts.join('\n')}`;

    const response = await openai.chat.completions.create({
        messages: [{ role: 'user', content }],
        model: 'gpt-4o-mini',
    });

    return response.choices[0].message.content;
}

module.exports = { scrapeChannel, processNews };
