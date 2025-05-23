const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
// Ensure you have a JWT_SECRET in your .env file
// Add JWT_SECRET=yoursupersecretkeyforjwts to server/.env

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Enhanced Input Validation
        if (typeof username !== 'string' || username.trim().length < 3) {
            return res.status(400).json({ message: 'Username must be a string with at least 3 characters.' });
        }
        if (typeof email !== 'string' || !email.trim().includes('@')) { // Basic email format check
            return res.status(400).json({ message: 'Valid email is required.' });
        }
        if (typeof password !== 'string' || password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
        }

        const trimmedUsername = username.trim();
        const trimmedEmail = email.trim().toLowerCase();

        let user = await User.findOne({ $or: [{ email: trimmedEmail }, { username: trimmedUsername }] });
        if (user) {
            return res.status(400).json({ message: 'User already exists with this email or username.' });
        }

        user = new User({ username: trimmedUsername, email: trimmedEmail, passwordHash: password }); // passwordHash will be hashed by pre-save hook
        await user.save();

        const token = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(201).json({ token, userId: user._id, username: user.username });
    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Enhanced Input Validation
        if (typeof email !== 'string' || !email.trim().includes('@')) { // Basic email format check
            return res.status(400).json({ message: 'Valid email is required.' });
        }
        if (typeof password !== 'string' || password.length === 0) { // Password cannot be empty
            return res.status(400).json({ message: 'Password is required.' });
        }

        const trimmedEmail = email.trim().toLowerCase();

        const user = await User.findOne({ email: trimmedEmail });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        const isMatch = await user.comparePassword(password); // Compare with the original password, not a trimmed one
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        const token = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, userId: user._id, username: user.username });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

// Logout (conceptual for JWT - client handles token deletion)
router.post('/logout', (req, res) => {
    // For JWT, logout is primarily a client-side operation (deleting the token).
    // Server-side blocklisting of tokens can be implemented for enhanced security if needed.
    res.status(200).json({ message: 'Logged out successfully. Please clear your token.' });
});

module.exports = router;
