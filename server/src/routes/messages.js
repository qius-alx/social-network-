const express = require('express');
const PrivateMessage = require('../models/PrivateMessage');
const User = require('../models/User'); // For auth middleware
const jwt = require('jsonwebtoken'); // For auth middleware
const mongoose = require('mongoose');

const router = express.Router();

// Auth middleware (can be imported if modularized)
const authMiddleware = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied.' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.userId).select('-passwordHash');
        if (!req.user) {
            return res.status(401).json({ message: 'User not found.' });
        }
        next();
    } catch (error) {
        console.error("Auth Middleware Error:", error.message);
        res.status(401).json({ message: 'Token is not valid.' });
    }
};

// Get chat history with another user
router.get('/history/:peerId', authMiddleware, async (req, res) => {
    try {
        const peerId = req.params.peerId;
        const userId = req.user._id; // from authMiddleware
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        if (!mongoose.Types.ObjectId.isValid(peerId)) {
            return res.status(400).json({ message: 'Invalid peer ID format.' });
        }

        const messages = await PrivateMessage.find({
            $or: [
                { senderId: userId, receiverId: peerId },
                { senderId: peerId, receiverId: userId }
            ]
        })
        .populate('senderId', 'username profilePicture')
        .populate('receiverId', 'username profilePicture')
        .sort({ timestamp: -1 }) // Get newest messages first
        .skip(skip)
        .limit(limit);

        // Mark messages as read for the current user (if they were the receiver)
        const messageIdsToMarkRead = messages
            .filter(msg => msg.receiverId._id.equals(userId) && !msg.isRead)
            .map(msg => msg._id);

        if (messageIdsToMarkRead.length > 0) {
            await PrivateMessage.updateMany(
                { _id: { $in: messageIdsToMarkRead }, receiverId: userId }, // Ensure only receiver marks as read
                { $set: { isRead: true } }
            );
        }
        
        // The messages are fetched newest first. Client can reverse if they want oldest first.
        res.json(messages); 

    } catch (error) {
        if (error.kind === 'ObjectId') { // Should be caught by isValid check, but good fallback
            return res.status(400).json({ message: 'Invalid peer ID format.' });
        }
        console.error("Get chat history error:", error);
        res.status(500).json({ message: 'Server error while fetching chat history.' });
    }
});

module.exports = router;
