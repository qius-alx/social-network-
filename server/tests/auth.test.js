const request = require('supertest');
// const express = require('express'); // No longer needed for app setup
const mongoose = require('mongoose');
const User = require('../src/models/User');
// const authRoutes = require('../src/routes/auth'); // Routes are part of the main app
const { app } = require('../src/index'); // Import the actual app

// let app; // app is now imported

beforeAll(() => {
    // JWT_SECRET should be set before app initialization if it's read at module level
    // However, our current app reads it on-demand, so setting it here is fine.
    // process.env.JWT_SECRET is already set in the testing environment (e.g. package.json script or globally)
    // If not, it should be set here: process.env.JWT_SECRET = 'testsecretkey';
    // MONGODB_URI is handled by setup.js using MONGODB_URI_TEST

    // app = express(); // No longer needed
    // app.use(express.json()); // No longer needed, app has this
    // app.use('/api/auth', authRoutes); // No longer needed, app has this
});


describe('Auth API', () => {
  const testUser = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
  };

  it('should register a new user successfully', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('userId');
    expect(res.body.username).toEqual(testUser.username);

    // Check user in DB
    const userInDb = await User.findOne({ email: testUser.email });
    expect(userInDb).not.toBeNull();
    expect(userInDb.username).toEqual(testUser.username);
  });

  it('should not register a user with an existing email', async () => {
    // First, register the user
    await request(app).post('/api/auth/register').send(testUser);
    // Then, attempt to register again with the same email
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...testUser, username: 'anotheruser' }); // Use a different username
    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toContain('User already exists');
  });

  it('should not register a user with an existing username', async () => {
    // First, register the user
    await request(app).post('/api/auth/register').send(testUser);
    // Then, attempt to register again with the same username
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...testUser, email: 'another@example.com' }); // Use a different email
    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toContain('User already exists');
  });


  it('should log in an existing user successfully', async () => {
    // Register user first - hash the password before saving as User model expects passwordHash
    // The pre-save hook in User.js will hash 'passwordHash' field if it's modified.
    // So, we send the plain password as 'passwordHash' to simulate the model's input.
    await new User({
        username: testUser.username,
        email: testUser.email,
        passwordHash: testUser.password // This will be hashed by the pre-save hook
    }).save();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.username).toEqual(testUser.username);
  });

  it('should not log in with invalid credentials (wrong password)', async () => {
    // Ensure user is in DB
    await new User({
        username: testUser.username,
        email: testUser.email,
        passwordHash: testUser.password
    }).save();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'wrongpassword' });
    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toContain('Invalid credentials');
  });

  it('should not log in with non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nonexistent@example.com', password: 'somepassword' });
    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toContain('Invalid credentials');
  });
});
