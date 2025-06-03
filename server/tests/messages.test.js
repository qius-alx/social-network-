const request = require('supertest');
// const express = require('express'); // No longer needed
const mongoose = require('mongoose');
const User = require('../src/models/User');
const PrivateMessage = require('../src/models/PrivateMessage');
// const messageRoutes = require('../src/routes/messages'); // Routes are part of the main app
const jwt = require('jsonwebtoken');
const { app } = require('../src/index'); // Import the actual app

// let app; // app is now imported
let user1, user2, token1;

beforeAll(async () => {
    // process.env.JWT_SECRET is already set in the testing environment or globally.
    // If not, it should be set here: process.env.JWT_SECRET = 'testsecretkey';
    // MONGODB_URI is handled by setup.js

    // app = express(); // No longer needed
    // app.use(express.json()); // No longer needed, app has this
    // app.use('/api/messages', messageRoutes); // No longer needed, app has this

    // Create test users
    user1 = await new User({ username: 'user1msg', email: 'user1msg@example.com', passwordHash: 'pass1msg' }).save();
    user2 = await new User({ username: 'user2msg', email: 'user2msg@example.com', passwordHash: 'pass2msg' }).save();
    token1 = jwt.sign({ userId: user1._id, username: user1.username }, process.env.JWT_SECRET);
});

describe('Message API - History', () => {
    it('should fetch chat history between two users', async () => {
        // Create some messages
        await PrivateMessage.create([
            { senderId: user1._id, receiverId: user2._id, content: 'Hello User2 (msg test)' },
            { senderId: user2._id, receiverId: user1._id, content: 'Hi User1 (msg test)' },
            { senderId: user1._id, receiverId: user2._id, content: 'How are you? (msg test)' },
        ]);

        const res = await request(app)
            .get(`/api/messages/history/${user2._id}`)
            .set('Authorization', `Bearer ${token1}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body).toBeInstanceOf(Array);
        expect(res.body.length).toEqual(3);
        // Messages are sorted newest first by the route (timestamp: -1)
        expect(res.body[0].content).toEqual('How are you? (msg test)');
        expect(res.body[2].content).toEqual('Hello User2 (msg test)');


        // Check if messages were marked as read
        // The message "Hi User1 (msg test)" has user1 as receiver.
        const receivedMessage = res.body.find(m => m.content === 'Hi User1 (msg test)');
        if (receivedMessage) {
             const dbMessage = await PrivateMessage.findById(receivedMessage._id);
             expect(dbMessage.isRead).toBe(true);
        } else {
            throw new Error("Test message 'Hi User1 (msg test)' not found in response.");
        }
    });

    it('should return empty array if no history with peer', async () => {
        const nonExistentPeerId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .get(`/api/messages/history/${nonExistentPeerId}`)
            .set('Authorization', `Bearer ${token1}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body).toBeInstanceOf(Array);
        expect(res.body.length).toEqual(0);
    });

    it('should return 401 if no token is provided for history', async () => {
        const res = await request(app)
            .get(`/api/messages/history/${user2._id}`); // No Authorization header
        // This test will pass if the mock auth middleware correctly leads to 401,
        // or if the actual app (when imported) handles it.
        // The current minimal setup with mock auth middleware might not trigger 401 in messageRoutes
        // if messageRoutes doesn't re-check for req.user.
        // The actual authMiddleware in messageRoutes.js should handle this.
        // To properly test this, the full app with its authMiddleware should be used.
        // For now, this tests if the route is reachable and returns based on mock.
        // The provided messageRoutes.js has its own authMiddleware, so it should be 401.
         expect(res.statusCode).toEqual(401);
    });
});
