import http from 'http';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import app from './app.js';
import User from './models/User.js';

// Setup environment for testing
dotenv.config();
process.env.NODE_ENV = 'test';
const PORT = 5001;
const BASE_URL = `http://localhost:${PORT}/api/auth`;

const runTests = async () => {
  console.log('--- STARTING AUTH MODULE INTEGRATION TESTS ---');

  // 1. Establish Database Connection
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected successfully for testing.');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }

  // 2. Clean up any prior test users
  await User.deleteMany({ mobileNumber: '03001234567' });
  console.log('Cleaned up previous test users.');

  // 3. Start Test HTTP Server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Test server listening on port ${PORT}`);

  let testAccessToken = '';

  try {
    // --- TEST 1: Register User ---
    console.log('\n[Test 1] Registering a new user...');
    const registerRes = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: 'testuser@gpgc.edu.pk',
        mobileNumber: '03001234567',
        password: 'password123',
        role: 'student',
      }),
    });
    const registerData = await registerRes.json();
    console.log('Status Code:', registerRes.status);
    console.log('Response:', JSON.stringify(registerData, null, 2));

    if (registerRes.status !== 201 || !registerData.success) {
      throw new Error('Registration failed!');
    }

    // --- TEST 2: Register Duplicate User ---
    console.log('\n[Test 2] Testing duplicate registration error handling...');
    const duplicateRes = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Another User',
        email: 'testuser@gpgc.edu.pk',
        mobileNumber: '03001234567',
        password: 'password123',
      }),
    });
    const duplicateData = await duplicateRes.json();
    console.log('Status Code:', duplicateRes.status);
    console.log('Response:', JSON.stringify(duplicateData, null, 2));

    if (duplicateRes.status !== 400 || duplicateData.success) {
      throw new Error('Duplicate check failed! It should return status 400.');
    }

    // --- TEST 3: Login Success ---
    console.log('\n[Test 3] Logging in with correct credentials...');
    const loginRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobileNumber: '03001234567',
        password: 'password123',
      }),
    });
    const loginData = await loginRes.json();
    console.log('Status Code:', loginRes.status);
    console.log('Response:', JSON.stringify(loginData, null, 2));

    if (loginRes.status !== 200 || !loginData.success) {
      throw new Error('Login failed!');
    }

    testAccessToken = loginData.data.accessToken;

    // --- TEST 4: Login Failure (Wrong password) ---
    console.log('\n[Test 4] Logging in with incorrect password...');
    const loginFailRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobileNumber: '03001234567',
        password: 'wrongpassword',
      }),
    });
    const loginFailData = await loginFailRes.json();
    console.log('Status Code:', loginFailRes.status);
    console.log('Response:', JSON.stringify(loginFailData, null, 2));

    if (loginFailRes.status !== 401 || loginFailData.success) {
      throw new Error('Incorrect credentials bypass! It should return status 401.');
    }

    // --- TEST 5: Protected Route Access (Authorized) ---
    console.log('\n[Test 5] Fetching protected profile with valid JWT...');
    const profileRes = await fetch(`${BASE_URL}/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testAccessToken}`,
      },
    });
    const profileData = await profileRes.json();
    console.log('Status Code:', profileRes.status);
    console.log('Response:', JSON.stringify(profileData, null, 2));

    if (profileRes.status !== 200 || !profileData.success) {
      throw new Error('Accessing protected route failed!');
    }

    // --- TEST 6: Protected Route Access (Unauthorized - No token) ---
    console.log('\n[Test 6] Fetching protected profile without JWT...');
    const profileFailRes = await fetch(`${BASE_URL}/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const profileFailData = await profileFailRes.json();
    console.log('Status Code:', profileFailRes.status);
    console.log('Response:', JSON.stringify(profileFailData, null, 2));

    if (profileFailRes.status !== 401 || profileFailData.success) {
      throw new Error('Unauthorized route bypass! It should return status 401.');
    }

    // --- TEST 7: Logout ---
    console.log('\n[Test 7] Logging out...');
    const logoutRes = await fetch(`${BASE_URL}/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testAccessToken}`,
      },
    });
    const logoutData = await logoutRes.json();
    console.log('Status Code:', logoutRes.status);
    console.log('Response:', JSON.stringify(logoutData, null, 2));

    if (logoutRes.status !== 200 || !logoutData.success) {
      throw new Error('Logout failed!');
    }

    console.log('\n--- ALL TESTS PASSED SUCCESSFULLY! ---');
  } catch (error) {
    console.error('\n--- TEST FAILED! ---');
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    // 6. Clean up database records
    await User.deleteMany({ mobileNumber: '03001234567' });
    console.log('\nCleaned up database test user entries.');

    // 7. Disconnect and Shutdown server
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');

    server.close(() => {
      console.log('Test HTTP server closed. Exiting test script.');
      process.exit();
    });
  }
};

runTests();
