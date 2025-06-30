require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('./models');
const bcrypt = require('bcryptjs');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  // Remove Goku, Naruto, Luffy therapists if they exist
  await User.deleteMany({ name: { $in: ['Goku', 'Naruto', 'Luffy'] }, role: 'therapist' });
  const password = await bcrypt.hash('test123', 10);
  const therapists = [
    {
      name: 'Dr. Emily Carter',
      email: 'emily.carter@example.com',
      password,
      role: 'therapist',
      specialization: 'Clinical Psychologist',
      availability: [{ day: 'Monday', start: '09:00', end: '17:00' }],
    },
    {
      name: 'Dr. Michael Thompson',
      email: 'michael.thompson@example.com',
      password,
      role: 'therapist',
      specialization: 'Counseling Psychologist',
      availability: [{ day: 'Tuesday', start: '10:00', end: '18:00' }],
    },
    {
      name: 'Dr. Sophia Lee',
      email: 'sophia.lee@example.com',
      password,
      role: 'therapist',
      specialization: 'Child & Adolescent Psychiatrist',
      availability: [{ day: 'Wednesday', start: '08:00', end: '16:00' }],
    },
  ];
  await User.insertMany(therapists);
  console.log('Sample therapists added!');
  await mongoose.disconnect();
}

seed().catch(console.error); 