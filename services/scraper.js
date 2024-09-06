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
      'Підведи підсумок постів за останній час',
      'Доступні теги: <b>жирний</b>, <i>курсив</i>, <u>підкреслений</u>, <a href="http://www.example.com/">посилання</a>.',
      'Шаблон посту: Емодзі <b>Заголовок</b> - текст <a href="url">дата і час</a>',
      'Використовуй емодзі',
      'Пости без нумерації',
      'Зроби текст позитивним, не спотворюючи зміст',
      'Текст повинен бути українською мовою',
      ...(isCompact
        ? ['Скороти кількість постів, вибери найважливіші та більш нові']
        : ['Вступе речення', 'Заключне речення',]
      ),
      'Ти пацан з району, розповідаєш про новини',
      'Називай мене "чувачок"',
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
