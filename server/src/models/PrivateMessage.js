const mongoose = require('mongoose');

const privateMessageSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true },
    timestamp: { type: Date, default: Date.now },
    isRead: { type: Boolean, default: false }
});

privateMessageSchema.index({ senderId: 1, receiverId: 1 });
privateMessageSchema.index({ timestamp: -1 });

module.exports = mongoose.model('PrivateMessage', privateMessageSchema);
