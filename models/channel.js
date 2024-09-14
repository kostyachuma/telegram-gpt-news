const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  username: {
    type: String
  },
  type: {
    type: String,
    required: true,
    enum: ['channel']
  }
}, { timestamps: true });

const Channel = mongoose.model('Channel', channelSchema);

module.exports = Channel;
