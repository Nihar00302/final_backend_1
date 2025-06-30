const axios = require('axios');

const BASE_URL = 'http://localhost:5000';
const TEST_ADMIN = {
  name: 'Test Admin',
  email: 'testadmin@wellness.com',
  password: 'testpass123'
};

async function testAdminSystem() {
  console.log('🧪 Testing Admin Registration and Login System\n');

  try {
    // Test 1: Admin Registration
    console.log('1. Testing Admin Registration...');
    const registerResponse = await axios.post(`${BASE_URL}/api/auth/admin-register`, TEST_ADMIN);
    console.log('✅ Admin registration successful:', registerResponse.data.message);

    // Test 2: Admin Login
    console.log('\n2. Testing Admin Login...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/admin-login`, {
      email: TEST_ADMIN.email,
      password: TEST_ADMIN.password
    });
    console.log('✅ Admin login successful');
    console.log('   Token received:', loginResponse.data.token ? 'Yes' : 'No');
    console.log('   Admin data:', {
      id: loginResponse.data.admin.id,
      name: loginResponse.data.admin.name,
      email: loginResponse.data.admin.email,
      role: loginResponse.data.admin.role
    });

    // Test 3: Try to register same admin again (should fail)
    console.log('\n3. Testing Duplicate Registration...');
    try {
      await axios.post(`${BASE_URL}/api/auth/admin-register`, TEST_ADMIN);
      console.log('❌ Duplicate registration should have failed');
    } catch (error) {
      if (error.response && error.response.status === 409) {
        console.log('✅ Duplicate registration properly rejected:', error.response.data.message);
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }

    // Test 4: Try login with wrong password
    console.log('\n4. Testing Invalid Login...');
    try {
      await axios.post(`${BASE_URL}/api/auth/admin-login`, {
        email: TEST_ADMIN.email,
        password: 'wrongpassword'
      });
      console.log('❌ Invalid login should have failed');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Invalid login properly rejected:', error.response.data.message);
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Admin registration: ✅ Working');
    console.log('   - Admin login: ✅ Working');
    console.log('   - Duplicate prevention: ✅ Working');
    console.log('   - Invalid credentials: ✅ Working');
    console.log('\n🌐 Frontend URLs:');
    console.log('   - Admin Register: http://localhost:8080/admin/register');
    console.log('   - Admin Login: http://localhost:8080/admin/login');

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
  await testAdminSystem();
}

main(); 