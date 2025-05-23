const express = require('express');
const Contact = require('../models/Contact');
const User = require('../models/User'); // For populating and auth middleware
const jwt = require('jsonwebtoken'); // For auth middleware

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

const mongoose = require('mongoose'); // Added for ObjectId validation

// Add a contact
router.post('/add', authMiddleware, async (req, res) => {
    try {
        const { contactId } = req.body;
        // Validate contactId
        if (!contactId || typeof contactId !== 'string') {
            return res.status(400).json({ message: 'Contact ID is required and must be a string.' });
        }
        if (!mongoose.Types.ObjectId.isValid(contactId)) {
            return res.status(400).json({ message: 'Invalid Contact ID format.' });
        }

        if (req.user._id.toString() === contactId) {
            return res.status(400).json({ message: 'Cannot add yourself as a contact.' });
        }

        // Check if the user to be added exists
        const contactUserExists = await User.findById(contactId);
        if (!contactUserExists) {
            return res.status(404).json({ message: 'User to add as contact not found.' });
        }

        // Check for existing contact
        const existingContact = await Contact.findOne({ userId: req.user._id, contactId });
        if (existingContact) {
            return res.status(400).json({ message: 'Contact already exists.' });
        }

        const newContact = new Contact({ userId: req.user._id, contactId });
        await newContact.save();
        
        // Populate contact details for the response
        const populatedContact = await Contact.findById(newContact._id)
            .populate('contactId', 'username profilePicture bio');

        res.status(201).json(populatedContact);
    } catch (error) {
        // Mongoose errors (like validation) might also come here
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        // The ObjectId.isValid check should catch format errors for contactId before DB query,
        // but this is a fallback for other potential errors or if an invalid ID slips through.
        if (error.kind === 'ObjectId' && error.path === '_id') { // Check if it's about the newContact._id
             console.error("Error generating new contact ID:", error); // Should be rare
             return res.status(500).json({ message: 'Server error creating contact ID.' });
        }
        // If it's about contactId from req.body, it should have been caught by mongoose.Types.ObjectId.isValid
        if (error.kind === 'ObjectId') { 
            return res.status(400).json({ message: 'Invalid ID format for related user.' });
        }
        console.error("Add contact error:", error);
        res.status(500).json({ message: 'Server error while adding contact.' });
    }
});

// Get all contacts for the logged-in user
router.get('/', authMiddleware, async (req, res) => {
    try {
        const contacts = await Contact.find({ userId: req.user._id })
            .populate('contactId', 'username profilePicture bio createdAt'); // Populate with selected user details
        
        // Map to return an array of populated contact user objects directly
        res.json(contacts.map(c => c.contactId)); 
    } catch (error) {
        console.error("Get contacts error:", error);
        res.status(500).json({ message: 'Server error while fetching contacts.' });
    }
});

// Remove a contact
router.delete('/remove/:contactId', authMiddleware, async (req, res) => {
    try {
        const { contactId } = req.params;
        // Validate contactId
        if (!contactId || typeof contactId !== 'string') { // Should be caught by route param presence, but good check
            return res.status(400).json({ message: 'Contact ID is required and must be a string.' });
        }
        if (!mongoose.Types.ObjectId.isValid(contactId)) {
            return res.status(400).json({ message: 'Invalid Contact ID format.' });
        }
        
        const result = await Contact.deleteOne({ userId: req.user._id, contactId });
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Contact not found or you are not authorized to remove this contact.' });
        }
        res.json({ message: 'Contact removed successfully.' });
    } catch (error) {
        // The ObjectId.isValid check should catch most format errors for contactId.
        if (error.kind === 'ObjectId') { 
            return res.status(400).json({ message: 'Invalid contact ID format during operation.' });
        }
        console.error("Remove contact error:", error);
        res.status(500).json({ message: 'Server error while removing contact.' });
    }
});

module.exports = router;
