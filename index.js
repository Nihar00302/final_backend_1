require('dotenv').config({ path: require('path').join(__dirname, '.env') });
console.log('Loaded GROQ_API_KEY:', process.env.GROQ_API_KEY, 'Length:', process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.length : 0);

// Fallback: Set GROQ_API_KEY directly if not loaded from .env
if (!process.env.GROQ_API_KEY) {
  process.env.GROQ_API_KEY = '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';
  console.log('Set GROQ_API_KEY from fallback, Length:', process.env.GROQ_API_KEY.length);
}

const MONGO_URI = 'mongodb://localhost:27017/mental-wellness-chat';
console.log('MONGO_URI:', MONGO_URI);
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const chatRouter = require('./chat');
const { User, Chat, Appointment, Admin } = require('./models');

// Set JWT secret with fallback
process.env.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Register route
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, address, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ 
      name, 
      email, 
      password: hashedPassword, 
      phone: phone || '', 
      address: address || '', 
      role 
    });
    await user.save();
    res.status(201).json({ message: 'User registered successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Login route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    // Restrict admin login to only the specified credentials
    if (user.role === 'admin') {
      if (user.email !== 'admin@wellness.com') {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get all therapists (with specialization and availability)
app.get('/api/therapists', async (req, res) => {
  try {
    const therapists = await User.find({ role: 'therapist' }, '-password');
    res.json(therapists);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch therapists.' });
  }
});

// Get a single therapist profile
app.get('/api/therapists/:id', async (req, res) => {
  try {
    const therapist = await User.findOne({ _id: req.params.id, role: 'therapist' }, '-password');
    if (!therapist) return res.status(404).json({ error: 'Therapist not found.' });
    res.json(therapist);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch therapist profile.' });
  }
});

// Get available time slots for a therapist on a specific date
app.get('/api/therapists/:therapistId/availability/:date', async (req, res) => {
  try {
    const { therapistId, date } = req.params;
    
    // Validate date format
    const requestedDate = new Date(date);
    if (isNaN(requestedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format.' });
    }
    
    // Check if date is in the past
    if (requestedDate <= new Date()) {
      return res.status(400).json({ error: 'Cannot check availability for past dates.' });
    }
    
    // Get therapist
    const therapist = await User.findById(therapistId);
    if (!therapist || therapist.role !== 'therapist') {
      return res.status(404).json({ error: 'Therapist not found.' });
    }
    
    // Get day of week
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = daysOfWeek[requestedDate.getDay()];
    
    // Check if therapist is available on this day
    const therapistAvailability = therapist.availability || [];
    const availableSlot = therapistAvailability.find(slot => slot.day === dayOfWeek);
    
    if (!availableSlot) {
      return res.json({ 
        available: false, 
        message: `Therapist is not available on ${dayOfWeek}`,
        availableDays: therapistAvailability.map(s => s.day)
      });
    }
    
    // Generate 30-minute time slots within the availability window
    const timeSlots = [];
    const [startHour, startMinute] = availableSlot.start.split(':').map(Number);
    const [endHour, endMinute] = availableSlot.end.split(':').map(Number);
    
    let currentHour = startHour;
    let currentMinute = startMinute;
    
    while (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute)) {
      const timeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
      timeSlots.push(timeString);
      
      currentMinute += 30;
      if (currentMinute >= 60) {
        currentHour++;
        currentMinute = 0;
      }
    }
    
    // Filter out already booked slots
    const bookedSlots = [];
    const existingAppointments = await Appointment.find({
      therapist: therapistId,
      date: {
        $gte: new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate()),
        $lt: new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate() + 1)
      },
      status: { $nin: ['rejected', 'cancelled'] }
    });
    
    existingAppointments.forEach(appointment => {
      const appointmentHour = appointment.date.getHours();
      const appointmentMinute = appointment.date.getMinutes();
      const bookedTime = `${appointmentHour.toString().padStart(2, '0')}:${appointmentMinute.toString().padStart(2, '0')}`;
      bookedSlots.push(bookedTime);
    });
    
    const availableSlots = timeSlots.filter(slot => !bookedSlots.includes(slot));
    
    // Filter out past times if the date is today
    const today = new Date();
    const isToday = requestedDate.toDateString() === today.toDateString();
    let finalAvailableSlots = availableSlots;
    
    if (isToday) {
      const nowMinutes = today.getHours() * 60 + today.getMinutes();
      finalAvailableSlots = availableSlots.filter(slot => {
        const [hour, minute] = slot.split(':').map(Number);
        return hour * 60 + minute > nowMinutes;
      });
    }
    
    res.json({
      available: true,
      dayOfWeek,
      availabilityWindow: `${availableSlot.start} - ${availableSlot.end}`,
      availableSlots: finalAvailableSlots,
      bookedSlots,
      totalSlots: timeSlots.length,
      availableCount: finalAvailableSlots.length
    });
    
  } catch (err) {
    console.error('Get availability error:', err);
    res.status(500).json({ error: 'Failed to get availability.' });
  }
});

// Book an appointment
app.post('/api/appointments', async (req, res) => {
  try {
    const { user, therapist, date, type } = req.body;
    
    // Basic validation
    if (!user || !therapist || !date) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    
    // Validate date format
    const appointmentDate = new Date(date);
    if (isNaN(appointmentDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format.' });
    }
    
    // Check if appointment is in the past
    if (appointmentDate <= new Date()) {
      return res.status(400).json({ error: 'Cannot book appointments in the past.' });
    }
    
    // Validate user and therapist exist
    const userDoc = await User.findById(user);
    const therapistDoc = await User.findById(therapist);
    
    if (!userDoc) {
      return res.status(404).json({ error: 'User not found.' });
    }
    if (!therapistDoc || therapistDoc.role !== 'therapist') {
      return res.status(404).json({ error: 'Therapist not found.' });
    }
    
    // Validate appointment type
    const validTypes = ['Video Call', 'In-Person', 'Phone Call'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid appointment type.' });
    }
    
    // Get day of week for the appointment
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const appointmentDay = daysOfWeek[appointmentDate.getDay()];
    const appointmentHour = appointmentDate.getHours();
    const appointmentMinute = appointmentDate.getMinutes();
    const appointmentTime = `${appointmentHour.toString().padStart(2, '0')}:${appointmentMinute.toString().padStart(2, '0')}`;
    
    // Check if therapist is available on this day
    const therapistAvailability = therapistDoc.availability || [];
    const availableSlot = therapistAvailability.find(slot => slot.day === appointmentDay);
    
    if (!availableSlot) {
      return res.status(400).json({ 
        error: `Therapist is not available on ${appointmentDay}. Available days: ${therapistAvailability.map(s => s.day).join(', ')}` 
      });
    }
    
    // Check if appointment time is within therapist's availability window
    const slotStart = availableSlot.start;
    const slotEnd = availableSlot.end;
    
    if (appointmentTime < slotStart || appointmentTime >= slotEnd) {
      return res.status(400).json({ 
        error: `Appointment time ${appointmentTime} is outside therapist's availability window (${slotStart}-${slotEnd}) on ${appointmentDay}` 
      });
    }
    
    // Check for existing appointments at the same time (30-minute slots)
    const appointmentStart = new Date(appointmentDate);
    const appointmentEnd = new Date(appointmentDate.getTime() + 30 * 60 * 1000); // 30 minutes later
    
    const conflictingAppointments = await Appointment.find({
      therapist: therapist,
      date: {
        $lt: appointmentEnd,
        $gte: appointmentStart
      },
      status: { $nin: ['rejected', 'cancelled'] }
    });
    
    if (conflictingAppointments.length > 0) {
      return res.status(409).json({ 
        error: 'This time slot is already booked. Please choose a different time.' 
      });
    }
    
    // Check if user already has an appointment at this time
    const userConflictingAppointments = await Appointment.find({
      user: user,
      date: {
        $lt: appointmentEnd,
        $gte: appointmentStart
      },
      status: { $nin: ['rejected', 'cancelled'] }
    });
    
    if (userConflictingAppointments.length > 0) {
      return res.status(409).json({ 
        error: 'You already have an appointment at this time. Please choose a different time.' 
      });
    }
    
    // Validate that appointment time is on a 30-minute interval
    if (appointmentMinute % 30 !== 0) {
      return res.status(400).json({ 
        error: 'Appointments must be scheduled on 30-minute intervals (e.g., 09:00, 09:30, 10:00, etc.)' 
      });
    }
    
    // All validations passed - create the appointment
    // Generate a unique Jitsi room name
    const shortId = Math.random().toString(36).substring(2, 10);
    const jitsiRoom = `wellness-app-${shortId}`;
    const appointment = new Appointment({ 
      user, 
      therapist, 
      date: appointmentDate, 
      type,
      status: 'pending',
      jitsiRoom
    });
    
    await appointment.save();
    
    res.status(201).json({ 
      message: 'Appointment booked successfully!', 
      appointment: {
        id: appointment._id,
        date: appointment.date,
        type: appointment.type,
        status: appointment.status,
        therapist: {
          name: therapistDoc.name,
          email: therapistDoc.email
        },
        jitsiRoom: appointment.jitsiRoom
      }
    });
    
  } catch (err) {
    console.error('Book appointment error:', err);
    res.status(500).json({ error: 'Failed to book appointment.', details: err.message });
  }
});

// Get all appointments for a therapist
app.get('/api/appointments/therapist/:therapistId', async (req, res) => {
  try {
    const appointments = await Appointment.find({ therapist: req.params.therapistId })
      .populate('user', 'name email phone')
      .sort({ date: 1 });
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch appointments.' });
  }
});

// Get all patients for a therapist (unique users with appointments)
app.get('/api/patients/therapist/:therapistId', async (req, res) => {
  try {
    const appointments = await Appointment.find({ therapist: req.params.therapistId }).populate('user', 'name email phone address');
    const patientsMap = {};
    appointments.forEach(a => {
      if (a.user && a.user._id) patientsMap[a.user._id] = a.user;
    });
    res.json(Object.values(patientsMap));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch patients.' });
  }
});

// Add/update notes and medication for an appointment
app.put('/api/appointments/:id/notes', async (req, res) => {
  try {
    const { notes, medication } = req.body;
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { $set: { notes, medication } },
      { new: true, runValidators: true }
    );
    if (!appointment) return res.status(404).json({ error: 'Appointment not found.' });
    res.json(appointment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update appointment notes.' });
  }
});

// Get a user's appointments
app.get('/api/appointments/user/:userId', async (req, res) => {
  try {
    const appointments = await Appointment.find({ user: req.params.userId })
      .populate('therapist', 'name email phone')
      .sort({ date: 1 });
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch appointments.' });
  }
});

// Get user profile
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});

// Update user profile
app.put('/api/users/:id', async (req, res) => {
  try {
    const allowedFields = ['name', 'phone', 'address'];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    // Password change logic
    if (req.body.oldPassword && req.body.newPassword) {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found.' });
      const isMatch = await bcrypt.compare(req.body.oldPassword, user.password);
      if (!isMatch) return res.status(400).json({ error: 'Old password is incorrect.' });
      user.password = await bcrypt.hash(req.body.newPassword, 10);
      if (Object.keys(updates).length > 0) {
        Object.assign(user, updates);
      }
      await user.save();
      return res.json({ message: 'Password updated successfully.' });
    }

    // Profile update logic (no password)
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true, select: '-password' }
    );
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user profile.' });
  }
});

// Accept/reject appointment (therapist)
app.put('/api/appointments/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'accepted', 'rejected', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true, runValidators: true }
    );
    if (!appointment) return res.status(404).json({ error: 'Appointment not found.' });
    res.json(appointment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update appointment status.' });
  }
});

// Admin: Add therapist
app.post('/api/admin/therapists', async (req, res) => {
  try {
    const { name, email, password, specialization, phone, address, availability } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const therapist = new User({
      name,
      email,
      password: hashedPassword,
      role: 'therapist',
      specialization,
      phone,
      address,
      availability
    });
    await therapist.save();
    res.status(201).json({ message: 'Therapist added.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add therapist.' });
  }
});

// Admin: Delete therapist
app.delete('/api/admin/therapists/:id', async (req, res) => {
  try {
    const therapist = await User.findOneAndDelete({ _id: req.params.id, role: 'therapist' });
    if (!therapist) return res.status(404).json({ error: 'Therapist not found.' });
    res.json({ message: 'Therapist deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete therapist.' });
  }
});

// Admin: List all users
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find({}, '-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// Admin: Delete user
app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ _id: req.params.id, role: { $ne: 'therapist' } });
    if (!user) return res.status(404).json({ error: 'User not found or is a therapist.' });
    res.json({ message: 'User deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// Admin: List all appointments
app.get('/api/admin/appointments', async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate('user', 'name email')
      .populate('therapist', 'name email')
      .sort({ date: -1 });
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch appointments.' });
  }
});

// Utility: Create default admin user if not exists
app.get('/api/setup-admin', async (req, res) => {
  try {
    const email = 'admin@wellness.com';
    const password = 'admin123';
    let admin = await User.findOne({ email, role: 'admin' });
    if (!admin) {
      const hashedPassword = await bcrypt.hash(password, 10);
      admin = new User({
        name: 'Admin',
        email,
        password: hashedPassword,
        role: 'admin',
      });
      await admin.save();
      return res.json({ message: 'Admin user created.', email, password });
    }
    res.json({ message: 'Admin user already exists.', email });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create admin.' });
  }
});

// Admin register route
app.post('/api/auth/admin-register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    
    const existing = await Admin.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Admin user already exists.' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = new Admin({
      name,
      email,
      password: hashedPassword
    });
    await admin.save();
    res.status(201).json({ message: 'Admin user created successfully!' });
  } catch (err) {
    console.error('ADMIN REGISTER ERROR:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Admin login route
app.post('/api/auth/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('[ADMIN LOGIN] Email:', email);
    if (!email || !password) {
      console.log('[ADMIN LOGIN] Missing fields');
      return res.status(400).json({ message: 'All fields are required.' });
    }
    const admin = await Admin.findOne({ email });
    console.log('[ADMIN LOGIN] Admin found:', !!admin);
    if (!admin) {
      console.log('[ADMIN LOGIN] Admin not found');
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(password, admin.password);
    console.log('[ADMIN LOGIN] Password match:', isMatch);
    if (!isMatch) {
      console.log('[ADMIN LOGIN] Password incorrect');
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ adminId: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    console.log('[ADMIN LOGIN] Success!');
    res.json({ token, admin: { id: admin._id, name: admin.name, email: admin.email, role: 'admin' } });
  } catch (err) {
    console.error('ADMIN LOGIN ERROR:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

app.use('/api', chatRouter);

// Auto-create or update admin user on server start
(async () => {
  try {
    console.log('Ensuring admin user exists in mental-wellness-chat.admin collection...');
  const bcrypt = require('bcryptjs');
  const password = await bcrypt.hash('admin@123', 10);
  await Admin.findOneAndUpdate(
    { email: 'admin@wellness.com' },
    { name: 'Admin', email: 'admin@wellness.com', password },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
    console.log('Admin user ensured in mental-wellness-chat.admin collection');
  } catch (err) {
    console.error('Error ensuring admin user:', err);
  }
})();

// --- ADMIN ANALYTICS ENDPOINTS ---
const getDateRange = (range) => {
  const now = new Date();
  let start, end;
  end = new Date(now);
  switch (range) {
    case 'this_week': {
      const day = now.getDay();
      start = new Date(now);
      start.setDate(now.getDate() - day);
      start.setHours(0,0,0,0);
      break;
    }
    case 'last_week': {
      const day = now.getDay();
      end = new Date(now);
      end.setDate(now.getDate() - day);
      end.setHours(0,0,0,0);
      start = new Date(end);
      start.setDate(end.getDate() - 7);
      break;
    }
    case 'past_15_days': {
      start = new Date(now);
      start.setDate(now.getDate() - 15);
      start.setHours(0,0,0,0);
      break;
    }
    case 'past_30_days': {
      start = new Date(now);
      start.setDate(now.getDate() - 30);
      start.setHours(0,0,0,0);
      break;
    }
    default: {
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      start.setHours(0,0,0,0);
      break;
    }
  }
  return { start, end };
};

// 1. Chatbot usage stats (all users)
app.get('/api/admin/chatbot-usage-stats', async (req, res) => {
  try {
    const chats = await Chat.find().populate('user', 'name email');
    const stats = chats.map(chat => ({
      user: chat.user ? { name: chat.user.name, email: chat.user.email } : {},
      totalMessages: chat.messages.length,
      lastUsed: chat.messages.length > 0 ? chat.messages[chat.messages.length-1].timestamp : null
    }));
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chatbot usage stats.' });
  }
});

// 2. System reports (accounts, chatbot, appointments)
app.get('/api/admin/system-reports', async (req, res) => {
  try {
    const { range = 'this_week' } = req.query;
    const { start, end } = getDateRange(range);

    // Accounts created
    const accountsCreated = await User.countDocuments({ createdAt: { $gte: start, $lt: end } });
    // Users who spoke with chatbot
    const chatbotUsers = await Chat.countDocuments({ createdAt: { $gte: start, $lt: end } });
    // Appointments booked
    const appointmentsBooked = await Appointment.countDocuments({ createdAt: { $gte: start, $lt: end } });
    // (Site visits placeholder)
    const siteVisits = null; // Not tracked

    res.json({
      accountsCreated,
      chatbotUsers,
      appointmentsBooked,
      siteVisits
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch system reports.' });
  }
});

module.exports = { app, User, Chat };

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 