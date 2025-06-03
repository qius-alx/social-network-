const express = require('express');
const Answer = require('../models/Answer');
const Question = require('../models/Question'); // To check question author for marking best answer
const User = require('../models/User'); // For auth middleware
const jwt = require('jsonwebtoken'); // For auth middleware
const mongoose = require('mongoose'); // For ObjectId validation

// mergeParams allows access to :questionId from parent router when mounted like /:questionId/answers
const router = express.Router({ mergeParams: true });

// Auth Middleware (ensure this is available, e.g. imported or defined)
const authMiddleware = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied.' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.userId).select('-passwordHash');
        if (!req.user) return res.status(401).json({ message: 'User not found.' });
        next();
    } catch (error) {
        console.error("Auth Middleware Error in answers.js:", error.message);
        res.status(401).json({ message: 'Token is not valid.' });
    }
};

// Post an answer to a question
// Route: POST /api/questions/:questionId/answers
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { content } = req.body;
        const { questionId } = req.params; // Available due to mergeParams

        // Validate content
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return res.status(400).json({ message: 'Answer content is required and must be a non-empty string.' });
        }
        // Validate questionId (already checked by mongoose.Types.ObjectId.isValid in practice via router structure, but explicit check is fine)
        if (!mongoose.Types.ObjectId.isValid(questionId)) {
            return res.status(400).json({ message: 'Invalid question ID format.' });
        }

        const question = await Question.findById(questionId);
        if (!question) {
            return res.status(404).json({ message: 'Question not found to post an answer to.' });
        }

        const trimmedContent = content.trim();
        const answer = new Answer({
            content: trimmedContent,
            authorId: req.user._id,
            questionId: questionId,
        });
        await answer.save();
        const populatedAnswer = await Answer.findById(answer._id).populate('authorId', 'username profilePicture');
        res.status(201).json(populatedAnswer);
    } catch (error) {
        if (error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid question ID.' });
        console.error("Post answer error:", error);
        res.status(500).json({ message: 'Server error while posting answer.' });
    }
});

// Get all answers for a question
// Route: GET /api/questions/:questionId/answers
router.get('/', async (req, res) => {
    try {
        const { questionId } = req.params; // Available due to mergeParams
        if (!mongoose.Types.ObjectId.isValid(questionId)) {
            return res.status(400).json({ message: 'Invalid question ID format.' });
        }

        const answers = await Answer.find({ questionId })
            .populate('authorId', 'username profilePicture')
            .sort({ isBestAnswer: -1, votes: -1, createdAt: -1 }); // Sort by best, votes, then date
        res.json(answers);
    } catch (error) {
        if (error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid question ID.' });
        console.error("Get answers error:", error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// Update an answer
// Route: PUT /api/answers/:answerId
// (Note: This route is defined for /api/answers, not /api/questions/:questionId/answers)
router.put('/:answerId', authMiddleware, async (req, res) => {
    try {
        const { answerId } = req.params;
        const { content } = req.body;

        if (!mongoose.Types.ObjectId.isValid(answerId)) {
            return res.status(400).json({ message: 'Invalid answer ID format.' });
        }
        // Validate content
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return res.status(400).json({ message: 'Answer content is required and must be a non-empty string for update.' });
        }

        const answer = await Answer.findById(answerId);
        if (!answer) {
            return res.status(404).json({ message: 'Answer not found.' });
        }

        if (answer.authorId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'User not authorized to update this answer.' });
        }

        answer.content = content.trim();
        // answer.updatedAt = Date.now(); // Model's pre-save hook should handle this
        await answer.save();

        const populatedAnswer = await Answer.findById(answer._id).populate('authorId', 'username profilePicture');
        res.json(populatedAnswer);
    } catch (error) {
        if (error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid answer ID.' });
        console.error("Update answer error:", error);
        res.status(500).json({ message: 'Server error while updating answer.' });
    }
});

// Delete an answer
// Route: DELETE /api/answers/:answerId
router.delete('/:answerId', authMiddleware, async (req, res) => {
    try {
        const { answerId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(answerId)) {
            return res.status(400).json({ message: 'Invalid answer ID format.' });
        }

        const answer = await Answer.findById(answerId);
        if (!answer) {
            return res.status(404).json({ message: 'Answer not found.' });
        }

        // Add admin role check here if needed: || req.user.isAdmin
        if (answer.authorId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'User not authorized to delete this answer.' });
        }

        await Answer.findByIdAndDelete(answerId);
        res.json({ message: 'Answer deleted successfully.' });
    } catch (error) {
        if (error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid answer ID.' });
        console.error("Delete answer error:", error);
        res.status(500).json({ message: 'Server error while deleting answer.' });
    }
});


// Vote on an answer
// Route: POST /api/answers/:answerId/vote
router.post('/:answerId/vote', authMiddleware, async (req, res) => {
    try {
        const { answerId } = req.params;
        const { voteType } = req.body; // 'upvote' or 'downvote'

        if (!mongoose.Types.ObjectId.isValid(answerId)) {
            return res.status(400).json({ message: 'Invalid answer ID format.' });
        }
        // Validate voteType
        if (!voteType || typeof voteType !== 'string' || !['upvote', 'downvote'].includes(voteType.toLowerCase())) {
            return res.status(400).json({ message: "Invalid vote type. Must be 'upvote' or 'downvote'." });
        }

        // For now, simple increment/decrement.
        // TODO: Prevent multiple votes from the same user by storing user votes.
        const updateAmount = voteType.toLowerCase() === 'upvote' ? 1 : -1;
        const answer = await Answer.findByIdAndUpdate(
            answerId,
            { $inc: { votes: updateAmount } }, // $inc atomically increments the field
            { new: true } // Returns the updated document
        ).populate('authorId', 'username profilePicture');

        if (!answer) {
            return res.status(404).json({ message: 'Answer not found for voting.' });
        }
        res.json(answer);
    } catch (error) {
        if (error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid answer ID.' });
        console.error("Vote error:", error);
        res.status(500).json({ message: 'Server error while voting.' });
    }
});

// Mark an answer as best
// Route: POST /api/answers/:answerId/mark-best
router.post('/:answerId/mark-best', authMiddleware, async (req, res) => {
    try {
        const { answerId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(answerId)) {
            return res.status(400).json({ message: 'Invalid answer ID format.' });
        }

        const answer = await Answer.findById(answerId);
        if (!answer) {
            return res.status(404).json({ message: 'Answer not found.' });
        }

        const question = await Question.findById(answer.questionId);
        if (!question) {
            return res.status(404).json({ message: 'Associated question not found.' });
        }

        if (question.authorId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only the author of the question can mark an answer as best.' });
        }

        // Atomically update answers: set the chosen one to true, others to false for the same question.
        await Answer.updateMany(
            { questionId: answer.questionId, _id: { $ne: answerId } },
            { $set: { isBestAnswer: false } }
        );
        answer.isBestAnswer = true;
        await answer.save();

        const populatedAnswer = await Answer.findById(answer._id)
                                    .populate('authorId', 'username profilePicture')
                                    .populate({ path: 'questionId', select: 'title authorId' }); // Also populate question info
        res.json(populatedAnswer);

    } catch (error) {
        if (error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid ID for answer or question.' });
        console.error("Mark best answer error:", error);
        res.status(500).json({ message: 'Server error while marking best answer.' });
    }
});

module.exports = router;
