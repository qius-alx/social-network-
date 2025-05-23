const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tags: [{ type: String, trim: true, lowercase: true }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    // popularityScore: { type: Number, default: 0 } // Can be derived or stored
});

questionSchema.index({ tags: 1 });
questionSchema.index({ authorId: 1 });
questionSchema.index({ createdAt: -1 });

questionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

questionSchema.pre('findOneAndUpdate', function(next) {
    this.set({ updatedAt: Date.now() });
    next();
});

module.exports = mongoose.model('Question', questionSchema);
