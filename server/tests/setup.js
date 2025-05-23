const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI_TEST = uri; // Use a different env var for test DB
  // It's often better to set this directly in mongoose.connect for tests
  // rather than relying on the main app's .env loading for test URI.
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterEach(async () => {
   // Clean up data between tests
   const collections = mongoose.connection.collections;
   for (const key in collections) {
       const collection = collections[key];
       await collection.deleteMany({});
   }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
