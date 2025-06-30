require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('./models');

async function listUsers() {
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const users = await User.find({ role: 'user' });
  users.forEach(u => {
    console.log(`ID: ${u._id} | Name: ${u.name} | Email: ${u.email}`);
  });
  await mongoose.disconnect();
}

listUsers().catch(console.error); 