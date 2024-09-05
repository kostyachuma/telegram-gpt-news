const OpenAI = require('openai');
const dateFns = require('date-fns');
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
    const formatedPosts = posts.reverse().map((post) => {
        return `text: ${post.message_text}\n date: ${post.datetime}\n url: ${post.message_url}`;
    });

    const prompts = [
      'Подведи итог постов за последнее время',
      'Доступные теги для форматирования текста: <b>bold</b>, <i>italic</i>, <u>underline</u>, <a href="http://www.example.com/">inline URL</a>',
      'Каждый пост должен быть по такому шаблону: текст, через пробел дата и время в таком виде <a href="url">d MMM yyyy HH:mm</a>',
      'Без нумерации',
      'Эмоджи в начале текста',
      'Эмоджи в тексте',
      'Называй меня чувачек',
      'Ты пацан с района рассказываешь о новостях',
      'Сделай текст более позитивным, не искажая смысл',
      // 'Сократи количество постов, выбери самые важные и более новые',
      'Текст должен быть на языке постов',
    ]

    const response = await openai.chat.completions.create({
        messages: [
          { role: 'system', content: prompts.join(';') },
          { role: 'user', content: formatedPosts.join('\n\n') }
        ],
        model: 'gpt-4o-mini',
    });

    return response.choices[0].message.content;
}

module.exports = { scrapeChannel, processNews };
