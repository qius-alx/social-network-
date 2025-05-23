const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
    content: { type: String, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    votes: { type: Number, default: 0 },
    isBestAnswer: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

answerSchema.index({ questionId: 1, votes: -1 });
answerSchema.index({ authorId: 1 });
answerSchema.index({ createdAt: -1 });

answerSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

answerSchema.pre('findOneAndUpdate', function(next) {
    this.set({ updatedAt: Date.now() });
    next();
});

module.exports = mongoose.model('Answer', answerSchema);
