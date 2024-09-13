const User = require('../models/user');
const { handleError } = require('../utils/errorHandler');

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

module.exports = {
    findOrCreateUser
};
