const mongoose = require('mongoose');

const globalMessageSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true },
    roomId: { type: String, default: 'global', required: true }, // Default room ID
    timestamp: { type: Date, default: Date.now }
});

globalMessageSchema.index({ roomId: 1, timestamp: -1 });

module.exports = mongoose.model('GlobalMessage', globalMessageSchema);
