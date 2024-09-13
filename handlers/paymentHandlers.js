const bot = require('../bot');
const User = require('../models/user');
const { sendUserChannels } = require('../services/messageService');
const { handleError } = require('../utils/errorHandler');

async function handlePreCheckoutQuery(ctx) {
    try {
        await bot.answerPreCheckoutQuery(ctx.id, true);
    } catch (error) {
        console.error("answerPreCheckoutQuery failed");
    }
}

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
        handleError(ctx.chat.id, "Помилка при збереженні оплаченого користувача:", error);
    } finally {
        await sendUserChannels(ctx.chat.id);
    }
}

module.exports = {
    handlePreCheckoutQuery,
    handleSuccessfulPayment
};
