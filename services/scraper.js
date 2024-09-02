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

    return JSON.parse(posts);
}

// Функция для обработки новостей через OpenAI
async function processNews(posts) {
    const formatedPosts = posts.map((post) => {
        return `text: ${post.message_text}\n date: ${post.datetime}\n url: ${post.message_url}`;
    });

    const prompts = [
      'Подведи итог постов за последнее время',
      'Доступные теги для форматирования текста: <b>bold</b>, <i>italic</i>, <u>underline</u>, <a href="http://www.example.com/">inline URL</a>',
      'Каждый пост должен быть по такому шаблону: текст, через пробел дата и время в таком виде <a href="url">дата в формате 1 Янв 2024 12:00</a>',
      'Используй эмоджи в тексте',
      'Называй меня чувачек',
      'Ты пацан с района рассказываешь о новостях',
      'Сделай текст более позитивным, не искажая смысл',
      // 'Сократи количество постов, выбери самые важные и более новые',
      'Текст должен быть на языке постов',
    ]

    // v1 Подведи итог новостей за день, добавь эмоджи, ты пацан с района, называй меня чувачек:
    const content = `${prompts.join('; ')}\n\n ${formatedPosts.join('\n\n')}`;

    const response = await openai.chat.completions.create({
        messages: [{ role: 'user', content }],
        model: 'gpt-4o-mini',
    });

    return response.choices[0].message.content;
}

module.exports = { scrapeChannel, processNews };
