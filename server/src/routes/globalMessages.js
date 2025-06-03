const express = require('express');
const GlobalMessage = require('../models/GlobalMessage');
const User = require('../models/User'); // For auth middleware
const jwt = require('jsonwebtoken'); // For auth middleware
const mongoose = require('mongoose');

const router = express.Router();

// Simple auth middleware (reuse or import from users.js if it's modularized there)
// For this subtask, defining it here as per example.
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
        console.error("Auth Middleware Error in globalMessages:", error.message);
        res.status(401).json({ message: 'Token is not valid.' });
    }
};

// Get global chat history
router.get('/history', authMiddleware, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 30; // Default limit 30
        const skip = (page - 1) * limit;

        const messages = await GlobalMessage.find({ roomId: 'global' }) // Filter by roomId
            .populate('senderId', 'username profilePicture') // Populate sender details
            .sort({ timestamp: -1 }) // Get newest messages first
            .skip(skip)
            .limit(limit);

        // Messages are fetched newest first (e.g., for infinite scroll).
        // Client can reverse if they want oldest first for initial load.
        res.json(messages);

    } catch (error) {
        console.error("Get global chat history error:", error);
        res.status(500).json({ message: 'Server error while fetching global chat history.' });
    }
});

module.exports = router;
