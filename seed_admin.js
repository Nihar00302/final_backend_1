// require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');
const { User } = require('./models');
const bcrypt = require('bcryptjs');

const MONGO_URI = 'mongodb://localhost:27017/resolve';

async function seedAdmin() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const existing = await User.findOne({ email: 'admin@wellness.com', role: 'admin' });
  if (existing) {
    console.log('Admin user already exists.');
    await mongoose.disconnect();
    return;
  }
  const password = await bcrypt.hash('admin@123', 10);
  const admin = new User({
    name: 'Admin',
    email: 'admin@wellness.com',
    password,
    role: 'admin',
  });
  await admin.save();
  console.log('Admin user created!');
  await mongoose.disconnect();
}

seedAdmin().catch(console.error); 