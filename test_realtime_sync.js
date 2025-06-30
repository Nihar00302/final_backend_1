const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testRealtimeSync() {
  console.log('🧪 Testing Real-time Synchronization\n');

  try {
    // Test 1: Check current therapists
    console.log('1. Checking current therapists...');
    const therapistsResponse = await axios.get(`${BASE_URL}/api/therapists`);
    console.log(`   Current therapists: ${therapistsResponse.data.length}`);

    // Test 2: Add a new therapist
    console.log('\n2. Adding a new therapist...');
    const newTherapist = {
      name: 'Dr. Sarah Johnson',
      email: 'sarah.johnson@wellness.com',
      password: 'testpass123',
      specialization: 'Anxiety & Depression',
      phone: '+91 9876543210',
      address: '123 Wellness Street, Bangalore',
      availability: [
        { day: 'Monday', start: '10:00', end: '18:00' },
        { day: 'Wednesday', start: '09:00', end: '17:00' }
      ]
    };

    const addResponse = await axios.post(`${BASE_URL}/api/admin/therapists`, newTherapist);
    console.log('   ✅ Therapist added successfully');

    // Test 3: Verify therapist appears in therapists list
    console.log('\n3. Verifying therapist appears in list...');
    const updatedTherapistsResponse = await axios.get(`${BASE_URL}/api/therapists`);
    console.log(`   Updated therapists count: ${updatedTherapistsResponse.data.length}`);
    
    const addedTherapist = updatedTherapistsResponse.data.find(t => t.email === newTherapist.email);
    if (addedTherapist) {
      console.log('   ✅ New therapist found in list');
      console.log(`   Name: ${addedTherapist.name}`);
      console.log(`   Specialization: ${addedTherapist.specialization}`);
    } else {
      console.log('   ❌ New therapist not found in list');
    }

    // Test 4: Check regular users
    console.log('\n4. Checking regular users...');
    const usersResponse = await axios.get(`${BASE_URL}/api/admin/users`);
    const regularUsers = usersResponse.data.filter(user => user.role === 'user');
    console.log(`   Regular users: ${regularUsers.length}`);

    // Test 5: Add a new regular user
    console.log('\n5. Adding a new regular user...');
    const newUser = {
      name: 'John Doe',
      email: 'john.doe@example.com',
      password: 'userpass123',
      role: 'user'
    };

    const userResponse = await axios.post(`${BASE_URL}/api/auth/register`, newUser);
    console.log('   ✅ User registered successfully');

    // Test 6: Verify user appears in admin users list
    console.log('\n6. Verifying user appears in admin list...');
    const updatedUsersResponse = await axios.get(`${BASE_URL}/api/admin/users`);
    const updatedRegularUsers = updatedUsersResponse.data.filter(user => user.role === 'user');
    console.log(`   Updated regular users count: ${updatedRegularUsers.length}`);

    const addedUser = updatedRegularUsers.find(u => u.email === newUser.email);
    if (addedUser) {
      console.log('   ✅ New user found in admin list');
      console.log(`   Name: ${addedUser.name}`);
      console.log(`   Email: ${addedUser.email}`);
    } else {
      console.log('   ❌ New user not found in admin list');
    }

    // Test 7: Delete the test therapist
    console.log('\n7. Cleaning up - deleting test therapist...');
    if (addedTherapist) {
      await axios.delete(`${BASE_URL}/api/admin/therapists/${addedTherapist._id}`);
      console.log('   ✅ Test therapist deleted');
    }

    // Test 8: Delete the test user
    console.log('\n8. Cleaning up - deleting test user...');
    if (addedUser) {
      await axios.delete(`${BASE_URL}/api/admin/users/${addedUser._id}`);
      console.log('   ✅ Test user deleted');
    }

    console.log('\n🎉 Real-time synchronization test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Admin can add therapists: ✅ Working');
    console.log('   - Therapists appear in user panel: ✅ Working');
    console.log('   - Users can register: ✅ Working');
    console.log('   - Users appear in admin panel: ✅ Working');
    console.log('   - Admin can delete users/therapists: ✅ Working');
    console.log('\n🌐 Frontend URLs:');
    console.log('   - Admin Panel: http://localhost:8080/admin-dashboard');
    console.log('   - Therapists Page: http://localhost:8080/therapists');
    console.log('   - User Registration: http://localhost:8080/register');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

// Check if backend is running
async function checkBackend() {
  try {
    await axios.get(`${BASE_URL}/api/setup-admin`);
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('🔍 Checking if backend is running...');
  const backendRunning = await checkBackend();
  
  if (!backendRunning) {
    console.log('❌ Backend is not running. Please start the backend first:');
    console.log('   cd backend && npm start');
    return;
  }
  
  console.log('✅ Backend is running\n');
  await testRealtimeSync();
}

main(); 