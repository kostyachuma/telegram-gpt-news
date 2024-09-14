const OpenAI = require('openai');
// const dateFns = require('date-fns');
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
async function processNews(posts, { isCompact } = { isCompact: false }) {
    const formatedPosts = posts.reverse().map((post) => {
        return `text: ${post.message_text}\n date: ${post.datetime}\n url: ${post.message_url}`;
    });

    const prompts = [
      'Ти пацан з району, який розповідає про останні новини. Звертайся до мене "чувачок".',
      'Підсумуй пости за останній час українською мовою. Зроби текст позитивним, не спотворюючи зміст.',
      'Доступні теги: <b>жирний</b>, <i>курсив</i>, <u>підкреслений</u>, <a href="http://www.example.com/">посилання</a>.',
      'Формат посту: Емодзі <b>{заголовок}</b> - {текст} <a href="{url}">{DD MMM YYYY HH:mm}</a>',
      'Приклад дати: 12 бер 2024 12:59',
      'Використовуй емодзі',
      'Пости без нумерації',
      ...(isCompact
        ? ['Вибери найважливіші та новіші пости']
        : ['Додай вступне та заключне речення']
      ),
    ];

    const response = await openai.chat.completions.create({
        messages: [
          { role: 'system', content: prompts.join('\n') },
          { role: 'user', content: ['Пости:', ...formatedPosts].join('\n') }
        ],
        model: 'gpt-4o-mini',
    });

    return response.choices[0].message.content;
}

module.exports = {
  scrapeChannel,
  processNews
};
