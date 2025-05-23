const express = require('express');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Middleware to verify token and add user to request
const authMiddleware = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied.' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.userId).select('-passwordHash'); // Attach user object to request
        if (!req.user) {
             return res.status(401).json({ message: 'User not found.' });
        }
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token is not valid.' });
    }
};

// Get user profile
router.get('/profile/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select('-passwordHash -email'); // Exclude sensitive info
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json(user);
    } catch (error) {
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid user ID format.' });
        }
        console.error("Get Profile Error:", error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// Update user profile (protected)
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const { bio, profilePicture } = req.body;
        // req.user is populated by authMiddleware
        const userToUpdate = await User.findById(req.user._id);

        if (!userToUpdate) {
            // This case should ideally not be reached if authMiddleware is effective
            // and the user exists in the DB, as req.user would be populated.
            return res.status(404).json({ message: 'User not found for update.' });
        }

        // Input validation for bio
        if (bio !== undefined) {
            if (typeof bio !== 'string') {
                return res.status(400).json({ message: 'Bio must be a string.' });
            }
            // Max length validation is handled by Mongoose schema (maxLength: 250)
            userToUpdate.bio = bio.trim();
        }

        // Input validation for profilePicture
        if (profilePicture !== undefined) {
            if (typeof profilePicture !== 'string') {
                return res.status(400).json({ message: 'Profile picture path/URL must be a string.' });
            }
            // Basic check if it looks somewhat like a URL or a path.
            // More complex URL validation can be added if required.
            // For now, ensuring it's a non-empty string if provided.
            if (profilePicture.trim() === '' && profilePicture !== '') { // if it's not empty but becomes empty after trim
                 userToUpdate.profilePicture = ''; // Allow explicitly setting to empty string
            } else if (profilePicture.trim() !== '') {
                 userToUpdate.profilePicture = profilePicture.trim();
            } else if (profilePicture === '') { // Explicitly setting to empty
                userToUpdate.profilePicture = '';
            }
            // Else, if undefined, it's not updated.
        }
        
        // username and email updates would require more checks (e.g., uniqueness)
        // and are not included here for simplicity for now.

        await userToUpdate.save();
        // Send back the updated user, excluding the passwordHash
        const updatedUser = await User.findById(req.user._id).select('-passwordHash');
        res.json({ message: 'Profile updated successfully.', user: updatedUser });
    } catch (error) {
        console.error("Update Profile Error:", error);
        res.status(500).json({ message: 'Server error while updating profile.' });
    }
});

// Search users (for contact list)
 router.get('/search', authMiddleware, async (req, res) => { // authMiddleware already applied
     try {
         const { query } = req.query;
         // Validate search query
         if (!query || typeof query !== 'string' || query.trim().length === 0) {
             return res.status(400).json({ message: 'Search query must be a non-empty string.' });
         }
         const trimmedQuery = query.trim();

         // Search by username (case-insensitive)
         // Email search is excluded here to avoid exposing emails unnecessarily through search.
         // If email search is desired, ensure it's handled carefully (e.g., exact match only, or admin only).
         const users = await User.find({
             username: { $regex: trimmedQuery, $options: 'i' } 
         }).select('-passwordHash -email'); // Exclude sensitive info

         res.json(users);
     } catch (error) {
         console.error("Search Users Error:", error);
         res.status(500).json({ message: 'Server error while searching users.' });
     }
 });


module.exports = router;
