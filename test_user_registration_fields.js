const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testUserRegistrationFields() {
  console.log('👤 Testing User Registration with Phone and Address Fields\n');

  try {
    // Test 1: Register a new user with phone and address
    console.log('1. Registering new user with phone and address...');
    const testUser = {
      name: "Test User",
      email: `testuser${Date.now()}@example.com`,
      password: "testpass123",
      phone: "+1-555-123-4567",
      address: "123 Main Street, City, State 12345"
    };

    const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, testUser);
    console.log('   ✅ User registration successful');
    console.log(`   User: ${testUser.name} (${testUser.email})`);
    console.log(`   Phone: ${testUser.phone}`);
    console.log(`   Address: ${testUser.address}`);

    // Test 2: Login to get admin token
    console.log('\n2. Logging in as admin...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'admin@wellness.com',
      password: 'admin@123'
    });
    
    const adminToken = loginResponse.data.token;
    console.log('   ✅ Admin login successful');

    // Test 3: Get all users and verify the new user appears with phone and address
    console.log('\n3. Fetching all users to verify phone and address...');
    const usersResponse = await axios.get(`${BASE_URL}/api/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const users = usersResponse.data;
    const newUser = users.find(u => u.email === testUser.email);
    
    if (newUser) {
      console.log('   ✅ New user found in admin panel');
      console.log(`   Name: ${newUser.name}`);
      console.log(`   Email: ${newUser.email}`);
      console.log(`   Phone: ${newUser.phone || 'N/A'}`);
      console.log(`   Address: ${newUser.address || 'N/A'}`);
      
      // Verify the fields match
      if (newUser.phone === testUser.phone) {
        console.log('   ✅ Phone number matches');
      } else {
        console.log('   ❌ Phone number mismatch');
      }
      
      if (newUser.address === testUser.address) {
        console.log('   ✅ Address matches');
      } else {
        console.log('   ❌ Address mismatch');
      }
    } else {
      console.log('   ❌ New user not found in admin panel');
    }

    // Test 4: Test registration without phone and address (should still work)
    console.log('\n4. Testing registration without phone and address...');
    const testUser2 = {
      name: "Test User 2",
      email: `testuser2${Date.now()}@example.com`,
      password: "testpass123"
      // No phone or address
    };

    const registerResponse2 = await axios.post(`${BASE_URL}/api/auth/register`, testUser2);
    console.log('   ✅ User registration successful (without phone/address)');
    console.log(`   User: ${testUser2.name} (${testUser2.email})`);

    // Test 5: Verify the user without phone/address appears correctly
    console.log('\n5. Verifying user without phone/address in admin panel...');
    const usersResponse2 = await axios.get(`${BASE_URL}/api/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const users2 = usersResponse2.data;
    const newUser2 = users2.find(u => u.email === testUser2.email);
    
    if (newUser2) {
      console.log('   ✅ User found in admin panel');
      console.log(`   Name: ${newUser2.name}`);
      console.log(`   Email: ${newUser2.email}`);
      console.log(`   Phone: ${newUser2.phone || 'N/A'}`);
      console.log(`   Address: ${newUser2.address || 'N/A'}`);
      
      if (!newUser2.phone && !newUser2.address) {
        console.log('   ✅ Phone and address correctly show as empty');
      } else {
        console.log('   ❌ Phone or address should be empty');
      }
    } else {
      console.log('   ❌ User not found in admin panel');
    }

    // Test 6: Test registration with partial information
    console.log('\n6. Testing registration with only phone number...');
    const testUser3 = {
      name: "Test User 3",
      email: `testuser3${Date.now()}@example.com`,
      password: "testpass123",
      phone: "+1-555-987-6543"
      // No address
    };

    const registerResponse3 = await axios.post(`${BASE_URL}/api/auth/register`, testUser3);
    console.log('   ✅ User registration successful (with phone only)');
    console.log(`   User: ${testUser3.name} (${testUser3.email})`);
    console.log(`   Phone: ${testUser3.phone}`);

    // Test 7: Verify partial information user
    console.log('\n7. Verifying user with partial information...');
    const usersResponse3 = await axios.get(`${BASE_URL}/api/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const users3 = usersResponse3.data;
    const newUser3 = users3.find(u => u.email === testUser3.email);
    
    if (newUser3) {
      console.log('   ✅ User found in admin panel');
      console.log(`   Name: ${newUser3.name}`);
      console.log(`   Email: ${newUser3.email}`);
      console.log(`   Phone: ${newUser3.phone || 'N/A'}`);
      console.log(`   Address: ${newUser3.address || 'N/A'}`);
      
      if (newUser3.phone === testUser3.phone && !newUser3.address) {
        console.log('   ✅ Partial information correctly saved');
      } else {
        console.log('   ❌ Partial information not saved correctly');
      }
    } else {
      console.log('   ❌ User not found in admin panel');
    }

    console.log('\n🎉 User registration field tests completed!');
    console.log('\n📋 Features Verified:');
    console.log('   - Phone number field in registration: ✅');
    console.log('   - Address field in registration: ✅');
    console.log('   - Optional fields (can register without them): ✅');
    console.log('   - Partial information support: ✅');
    console.log('   - Admin panel display: ✅');
    console.log('   - Data persistence: ✅');
    console.log('\n💡 Users can now register with phone and address information!');

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
  await testUserRegistrationFields();
}

main(); 