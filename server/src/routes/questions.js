const express = require('express');
const Question = require('../models/Question');
const Answer = require('../models/Answer'); // For populating answer counts or details
const User = require('../models/User'); // For auth middleware
const jwt = require('jsonwebtoken'); // For auth middleware
const mongoose = require('mongoose'); // For ObjectId validation

const router = express.Router();

// Auth Middleware
const authMiddleware = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied.' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.userId).select('-passwordHash');
        if (!req.user) return res.status(401).json({ message: 'User not found.' });
        next();
    } catch (error) {
        console.error("Auth Middleware Error in questions.js:", error.message);
        res.status(401).json({ message: 'Token is not valid.' });
    }
};

// Ask a new question
router.post('/ask', authMiddleware, async (req, res) => {
    try {
        const { title, content, tags } = req.body;

        // Validate title
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            return res.status(400).json({ message: 'Title is required and must be a non-empty string.' });
        }
        // Validate content
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return res.status(400).json({ message: 'Content is required and must be a non-empty string.' });
        }
        // Validate tags
        let processedTags = [];
        if (tags !== undefined) { // Tags are optional
            if (!Array.isArray(tags)) {
                return res.status(400).json({ message: 'Tags must be an array of strings.' });
            }
            processedTags = tags.map(tag => {
                if (typeof tag !== 'string') {
                    // Or throw an error, or filter out non-string tags
                    console.warn("Non-string tag found and ignored:", tag); 
                    return ''; // Will be filtered out later or handled by schema
                }
                return tag.trim().toLowerCase();
            }).filter(tag => tag.length > 0); // Remove empty tags resulting from trim or non-string
        }
        
        const trimmedTitle = title.trim();
        const trimmedContent = content.trim();

        const question = new Question({
            title: trimmedTitle,
            content: trimmedContent,
            tags: processedTags,
            authorId: req.user._id,
        });
        await question.save();
        const populatedQuestion = await Question.findById(question._id).populate('authorId', 'username profilePicture');
        res.status(201).json(populatedQuestion);
    } catch (error) {
        console.error("Ask question error:", error);
        res.status(500).json({ message: 'Server error while posting question.' });
    }
});

// Get all questions (with filtering and pagination)
router.get('/', async (req, res) => {
    try {
        let { page, limit, tag, sortBy } = req.query;

        // Validate and sanitize page
        page = parseInt(page);
        if (isNaN(page) || page < 1) page = 1;

        // Validate and sanitize limit
        limit = parseInt(limit);
        if (isNaN(limit) || limit < 1) limit = 10;
        else if (limit > 50) limit = 50; // Max limit

        const query = {};
        if (tag && typeof tag === 'string' && tag.trim().length > 0) {
            query.tags = { $in: [tag.trim().toLowerCase()] };
        }

        let sortOption = { createdAt: -1 }; // Default sort by date (newest first)
        const allowedSortBy = ['date', 'popularity']; // Popularity not implemented yet
        if (sortBy && typeof sortBy === 'string' && allowedSortBy.includes(sortBy.toLowerCase())) {
            if (sortBy.toLowerCase() === 'popularity') {
                // sortOption = { popularityScore: -1 }; // Uncomment when score exists
                console.log("Popularity sort requested but not implemented yet. Defaulting to date.");
            }
            // 'date' is default
        }
        
        const skip = (page - 1) * limit;

        const questions = await Question.find(query)
            .populate('authorId', 'username profilePicture')
            .sort(sortOption)
            .skip(skip)
            .limit(limit);
        
        const totalQuestions = await Question.countDocuments(query);

        res.json({
            questions,
            totalPages: Math.ceil(totalQuestions / limit),
            currentPage: page,
            totalQuestions
        });
    } catch (error) {
        console.error("Get questions error:", error);
        res.status(500).json({ message: 'Server error while fetching questions.' });
    }
});

// Get a single question by ID
router.get('/:questionId', async (req, res) => {
    try {
        const { questionId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(questionId)) {
            return res.status(400).json({ message: 'Invalid question ID format.' });
        }

        const question = await Question.findById(questionId)
            .populate('authorId', 'username profilePicture');
        
        if (!question) {
            return res.status(404).json({ message: 'Question not found.' });
        }
        // Fetch answers separately for now as per example, can be refined with virtuals later
        const answers = await Answer.find({ questionId: questionId })
                                  .populate('authorId', 'username profilePicture')
                                  .sort({ isBestAnswer: -1, votes: -1, createdAt: -1 }); 
        res.json({ question, answers });
    } catch (error) {
        // The ObjectId.isValid check should catch most format errors,
        // but this is a fallback for other potential errors during DB query.
        if (error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid question ID.' });
        console.error("Get single question error:", error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// PUT /api/questions/:questionId - Update a question
router.put('/:questionId', authMiddleware, async (req, res) => {
    try {
        const { questionId } = req.params;
        const { title, content, tags } = req.body;

        if (!mongoose.Types.ObjectId.isValid(questionId)) {
            return res.status(400).json({ message: 'Invalid question ID format.' });
        }

        // Validate inputs from body
        if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
            return res.status(400).json({ message: 'Title must be a non-empty string.' });
        }
        if (content !== undefined && (typeof content !== 'string' || content.trim().length === 0)) {
            return res.status(400).json({ message: 'Content must be a non-empty string.' });
        }
        let processedTags;
        if (tags !== undefined) {
            if (!Array.isArray(tags)) {
                return res.status(400).json({ message: 'Tags must be an array of strings.' });
            }
            processedTags = tags.map(tag => {
                if (typeof tag !== 'string') {
                    console.warn("Non-string tag found and ignored during update:", tag);
                    return '';
                }
                return tag.trim().toLowerCase();
            }).filter(tag => tag.length > 0);
        }


        const question = await Question.findById(questionId);
        if (!question) {
            return res.status(404).json({ message: 'Question not found.' });
        }

        if (question.authorId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'User not authorized to update this question.' });
        }

        if (title !== undefined) question.title = title.trim();
        if (content !== undefined) question.content = content.trim();
        if (processedTags !== undefined) question.tags = processedTags;
        
        // question.updatedAt = Date.now(); // Model's pre-save hook should handle this
        await question.save();
        
        const populatedQuestion = await Question.findById(question._id).populate('authorId', 'username profilePicture');
        res.json(populatedQuestion);
    } catch (error) {
        if (error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid question ID.' });
        console.error("Update question error:", error);
        res.status(500).json({ message: 'Server error while updating question.' });
    }
});

// DELETE /api/questions/:questionId - Delete a question
router.delete('/:questionId', authMiddleware, async (req, res) => {
    try {
        const { questionId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(questionId)) {
            return res.status(400).json({ message: 'Invalid question ID format.' });
        }

        const question = await Question.findById(questionId);
        if (!question) {
            return res.status(404).json({ message: 'Question not found.' });
        }

        // Add admin role check here if needed: || req.user.isAdmin
        if (question.authorId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'User not authorized to delete this question.' });
        }

        // Also delete all answers associated with this question
        await Answer.deleteMany({ questionId: questionId });
        await Question.findByIdAndDelete(questionId);

        res.json({ message: 'Question and associated answers deleted successfully.' });
    } catch (error) {
        if (error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid question ID.' });
        console.error("Delete question error:", error);
        res.status(500).json({ message: 'Server error while deleting question.' });
    }
});


module.exports = router;
