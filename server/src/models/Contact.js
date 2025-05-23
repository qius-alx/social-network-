const mongoose = require('mongoose');

// This schema represents a directional contact relationship (user_id follows contact_id)
// For a mutual friendship, two entries would exist, or a different schema structure.
const contactSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // The user who initiated the contact/follow
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // The user being contacted/followed
    createdAt: { type: Date, default: Date.now }
});

contactSchema.index({ userId: 1, contactId: 1 }, { unique: true }); // Ensure no duplicate contact entries

module.exports = mongoose.model('Contact', contactSchema);
