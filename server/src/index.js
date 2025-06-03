require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const mongoose = require('mongoose'); // Added

// Added: Mongoose Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => console.error('MongoDB connection error:', err));

const app = express();

// Added: Import route modules
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
// Import models and jwt for Socket.IO
const User = require('./models/User');
const PrivateMessage = require('./models/PrivateMessage');
const GlobalMessage = require('./models/GlobalMessage'); // Added for global chat
const jwt = require('jsonwebtoken');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // Adjust for your client URL
    methods: ["GET", "POST"]
  }
});

// Socket.IO Authentication Middleware
const socketAuthMiddleware = async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error: Token not provided'));
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = await User.findById(decoded.userId).select('-passwordHash');
        if (!socket.user) {
            return next(new Error('Authentication error: User not found'));
        }
        next();
    } catch (err) {
        console.error("Socket Auth Error:", err.message);
        next(new Error('Authentication error: Invalid token'));
    }
};

io.use(socketAuthMiddleware); // Apply middleware to all incoming connections

let onlineUsers = {}; // { userId: socketId }

io.on('connection', (socket) => {
    console.log(`User ${socket.user.username} connected with socket id ${socket.id}`);
    onlineUsers[socket.user._id.toString()] = socket.id;
    socket.join('global'); // Automatically join the global room

    socket.on('globalMessage', async ({ content }) => {
        // Validate content
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return socket.emit('messageError', { message: 'Message content must be a non-empty string.' });
        }
        const trimmedContent = content.trim();

        try {
            const message = new GlobalMessage({
                senderId: socket.user._id,
                content: trimmedContent, // Use trimmed content
                roomId: 'global', // Explicitly set roomId
            });
            await message.save();

            const populatedMessage = await GlobalMessage.findById(message._id)
                                          .populate('senderId', 'username profilePicture');

            // Broadcast to everyone in the 'global' room including the sender
            io.to('global').emit('newGlobalMessage', populatedMessage);

        } catch (error) {
            console.error('Error sending global message:', error);
            if (error.name === 'ValidationError') {
                 return socket.emit('messageError', { message: `Validation Error: ${error.message}`});
            }
            socket.emit('messageError', { message: 'Failed to send global message due to server error.' });
        }
    });

    socket.on('privateMessage', async ({ receiverId, content }) => {
        // Validate content
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return socket.emit('messageError', { message: 'Message content must be a non-empty string.' });
        }
        // Validate receiverId
        if (!receiverId || typeof receiverId !== 'string' || !mongoose.Types.ObjectId.isValid(receiverId)) {
            return socket.emit('messageError', { message: 'Valid receiver ID is required.' });
        }

        const trimmedContent = content.trim();

        if (receiverId === socket.user._id.toString()) {
            return socket.emit('messageError', { message: 'Cannot send message to yourself.' });
        }

        try {
            const message = new PrivateMessage({
                senderId: socket.user._id,
                receiverId: receiverId,
                content: trimmedContent, // Use trimmed content
            });
            await message.save();

            const populatedMessage = await PrivateMessage.findById(message._id)
                                          .populate('senderId', 'username profilePicture')
                                          .populate('receiverId', 'username profilePicture');

            const receiverSocketId = onlineUsers[receiverId];
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('newPrivateMessage', populatedMessage);
            }
            // Send message back to sender for confirmation and UI update
            socket.emit('newPrivateMessage', populatedMessage);

        } catch (error) {
            console.error('Error sending private message:', error);
            // Check for specific Mongoose validation errors if needed
            if (error.name === 'ValidationError') {
                 return socket.emit('messageError', { message: `Validation Error: ${error.message}`});
            }
            socket.emit('messageError', { message: 'Failed to send message due to server error.' });
        }
    });

    socket.on('markAsRead', async ({ messageId, readerId }) => {
        // Validate messageId
        if (!messageId || typeof messageId !== 'string' || !mongoose.Types.ObjectId.isValid(messageId)) {
            return socket.emit('messageError', { message: 'Invalid message ID for marking as read.' });
        }
        // Validate readerId from payload and ensure it matches authenticated user
        if (!readerId || typeof readerId !== 'string' || !mongoose.Types.ObjectId.isValid(readerId) || readerId !== socket.user._id.toString()) {
             return socket.emit('messageError', { message: 'Authorization error: Reader ID is invalid or does not match authenticated user.' });
        }

        try {
            const message = await PrivateMessage.findById(messageId);
            // Ensure the message exists and the user attempting to mark is the receiver
            if (message && message.receiverId._id.toString() === socket.user._id.toString() && !message.isRead) {
                message.isRead = true;
                await message.save();
                const senderSocketId = onlineUsers[message.senderId._id.toString()];
                if(senderSocketId){
                    // Notify sender that the message was read
                    io.to(senderSocketId).emit('messageRead', { messageId: message._id, readerId: socket.user._id.toString() });
                }
                // Notify the current user (all their sessions) that the message is marked as read
                socket.emit('messageRead', { messageId: message._id, readerId: socket.user._id.toString() });

            } else if (message && message.receiverId._id.toString() !== socket.user._id.toString()) {
                socket.emit('messageError', { message: "Cannot mark this message as read: you are not the receiver." });
            } else if (message && message.isRead) {
                // Optional: inform if already read, or just do nothing
                 socket.emit('messageStatus', { messageId: message._id, status: 'already_read' }); // Custom event
            } else if (!message) {
                socket.emit('messageError', { message: "Message not found for marking as read." });
            }
        } catch (error) {
            console.error('Error marking message as read:', error);
            socket.emit('messageError', { message: 'Server error while marking message as read.' });
        }
    });

    socket.on('disconnect', () => {
        if (socket.user && socket.user.username) { // Check if socket.user exists
            console.log(`User ${socket.user.username} disconnected`);
            delete onlineUsers[socket.user._id.toString()];
            socket.leave('global'); // User leaves the global room on disconnect
        } else {
            console.log('A user disconnected (username not available, possibly failed auth)');
        }
    });
});

app.use(express.json()); // Middleware to parse JSON bodies

// Added: Use route modules
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
// Import and use contact and message routes
const contactRoutes = require('./routes/contacts');
const messageRoutes = require('./routes/messages');
const globalMessagesRoutes = require('./routes/globalMessages');
const questionRoutes = require('./routes/questions'); // Added
const answerRoutes = require('./routes/answers'); // Added

app.use('/api/contacts', contactRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/global-messages', globalMessagesRoutes);

// Mount question routes
app.use('/api/questions', questionRoutes); // Handles /api/questions and /api/questions/:questionId

// Mount answer routes
// For posting/getting answers specific to a question: /api/questions/:questionId/answers
questionRoutes.use('/:questionId/answers', answerRoutes);

// For general answer actions like voting, marking best, updating, deleting by answerId
app.use('/api/answers', answerRoutes);


app.get('/', (req, res) => {
  res.send('<h1>Hello world - Q&A and Chat API</h1>');
});

const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = { app, server }; // Export app and server for testing
