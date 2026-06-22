import http from 'http';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import app from './app.js';
import User from './models/User.js';
import Student from './models/Student.js';
import RegistrationNumber from './models/RegistrationNumber.js';

// Setup environment for testing
dotenv.config();
process.env.NODE_ENV = 'test';
const PORT = 5006;
const BASE_URL = `http://localhost:${PORT}/api/auth`;

const runTests = async () => {
  console.log('--- STARTING STUDENT LOGIN BY REGISTRATION NUMBER INTEGRATION TESTS ---');

  // 1. Establish Database Connection
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected successfully for testing.');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }

  // 2. Clean up any prior test records
  const testRegNo = 'REG-LOGIN-TEST-123';
  const testMobile = '03007654321';
  const testEmail = 'loginregtest@gpgc.edu.pk';

  await User.deleteMany({ mobileNumber: testMobile });
  await Student.deleteMany({ registrationNumber: testRegNo });
  await RegistrationNumber.deleteMany({ number: testRegNo });
  console.log('Cleaned up previous test records.');

  // Pre-approve the registration number
  await RegistrationNumber.create({ number: testRegNo, isUsed: false });
  console.log('Pre-approved registration number: ' + testRegNo);

  // 3. Start Test HTTP Server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Test server listening on port ${PORT}`);

  try {
    // --- TEST 1: Self-Register Student ---
    console.log('\n[Test 1] Registering a student self-account with pre-approved registration number...');
    const registerRes = await fetch(`${BASE_URL}/register-student`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Login Test Student',
        email: testEmail,
        mobileNumber: testMobile,
        password: 'password123',
        registrationNumber: testRegNo,
        rollNumber: 'ROLL-LOGIN-TEST-123',
        semester: 1,
        academicSession: 'BSCS 2026-2030',
        address: 'Lakki Marwat'
      }),
    });
    const registerData = await registerRes.json();
    console.log('Status Code:', registerRes.status);
    console.log('Response:', JSON.stringify(registerData, null, 2));

    if (registerRes.status !== 201 || !registerData.success) {
      throw new Error('Student self-registration failed!');
    }

    // --- TEST 2: Login via Registration Number ---
    console.log('\n[Test 2] Logging in using student registration number...');
    const loginRegRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobileNumber: testRegNo, // Field name remains mobileNumber as sent by body
        password: 'password123',
      }),
    });
    const loginRegData = await loginRegRes.json();
    console.log('Status Code:', loginRegRes.status);
    console.log('Response:', JSON.stringify(loginRegData, null, 2));

    if (loginRegRes.status !== 200 || !loginRegData.success) {
      throw new Error('Login with registration number failed!');
    }
    console.log('SUCCESS: Logged in using registration number! Token role:', loginRegData.data.role);

    // --- TEST 3: Login via Mobile Number ---
    console.log('\n[Test 3] Logging in using student mobile number...');
    const loginMobRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobileNumber: testMobile,
        password: 'password123',
      }),
    });
    const loginMobData = await loginMobRes.json();
    console.log('Status Code:', loginMobRes.status);
    console.log('Response:', JSON.stringify(loginMobData, null, 2));

    if (loginMobRes.status !== 200 || !loginMobData.success) {
      throw new Error('Login with mobile number failed!');
    }
    console.log('SUCCESS: Logged in using mobile number! Token role:', loginMobData.data.role);

    // --- TEST 4: Login with Wrong Password ---
    console.log('\n[Test 4] Logging in with wrong password...');
    const loginFailRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobileNumber: testRegNo,
        password: 'wrongpassword',
      }),
    });
    console.log('Status Code:', loginFailRes.status);
    if (loginFailRes.status !== 401) {
      throw new Error('Wrong password didn\'t fail with 401!');
    }
    console.log('SUCCESS: Wrong password login correctly rejected.');

    console.log('\n--- ALL REGISTRATION NUMBER LOGIN TESTS PASSED SUCCESSFULLY! ---');
  } catch (error) {
    console.error('\n--- TEST FAILED! ---');
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    // 6. Clean up database records
    await User.deleteMany({ mobileNumber: testMobile });
    await Student.deleteMany({ registrationNumber: testRegNo });
    await RegistrationNumber.deleteMany({ number: testRegNo });
    console.log('\nCleaned up database test entries.');

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
