# About the project

**Telegram News Bot** is a Telegram bot that collects news from public channels and delivers them to users in a single message, processed and summarized by ChatGPT for easier consumption.

The bot is built using the following technologies:

- **OpenAI API**
- **Telegram Bot API**
- **MongoDB**
- **Node.js**
- **JavaScript**

You can try the bot here: [Telegram News Bot](https://t.me/aifeedrobot).

---

# How to run the bot

To run the bot on your computer or server, follow these steps:

1. **Install the necessary dependencies**

   ```bash
   npm install
   ```

2. **Create a configuration file**

   Create a `.env` file in the root directory of the project and add the following variables:

   ```env
   TELEGRAM_TOKEN=your_bot_token_from_BotFather
   OPENAI_API_KEY=your_openai_api_key
   OPENAI_ORGANIZATION=your_openai_organization_id
   MONGODB_URI=your_mongodb_connection_uri
   ```

3. **Start the bot**

   To start the bot, run:

   ```bash
   npm run start
   ```

4. **Development and making changes**

   If you're working on the bot and want it to automatically restart when changes are made, use the following command:

   ```bash
   npm run dev
   ```

5. **Test the bot**

   Open Telegram and find your bot by its username. Send the `/start` command to ensure the bot is working correctly.

**Notes:**

- **MongoDB**: Make sure you have access to a MongoDB instance. You can use a local database or the cloud-based [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) service.
- **Telegram Bot Token**: Obtain a token for your bot from [BotFather](https://t.me/BotFather) on Telegram.
- **OpenAI API Key and Organization**: Sign up at [OpenAI](https://platform.openai.com/signup/) and get your API key and organization ID.
