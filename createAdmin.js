/**
 * Admin Seed Script
 * Creates an admin user directly in MongoDB — run ONCE to set up admin credentials.
 * Usage: node createAdmin.js
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

// ── Inline minimal User schema (avoids importing full model chain) ──
const userSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  email:         { type: String },
  mobileNumber:  { type: String, required: true, unique: true },
  password:      { type: String, required: true },
  role:          { type: String, enum: ['admin', 'teacher', 'student'], default: 'student' },
  address:       { type: String, default: '' },
  profileImage:  { type: String, default: '' },
  isActive:      { type: Boolean, default: true },
  isBlocked:     { type: Boolean, default: false },
  tokenVersion:  { type: Number, default: 0 },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);

async function createAdmin() {
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check if admin already exists
    const existing = await User.findOne({ mobileNumber: '03001234567' });
    if (existing) {
      console.log('⚠️  Admin already exists!\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('  📱 Mobile Number : 03001234567');
      console.log('  🔑 Password      : Admin@1234');
      console.log('  👤 Role          : admin');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      await mongoose.disconnect();
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('Admin@1234', 12);

    // Create admin user
    const admin = await User.create({
      name:         'Admin',
      email:        'admin@gpgc.edu.pk',
      mobileNumber: '03001234567',
      password:     hashedPassword,
      role:         'admin',
      address:      'GPGC Lakki Marwat, KPK, Pakistan',
      isActive:     true,
      isBlocked:    false,
    });

    console.log('🎉 Admin account created successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  📱 Mobile Number : 03001234567');
    console.log('  🔑 Password      : Admin@1234');
    console.log('  📧 Email         : admin@gpgc.edu.pk');
    console.log('  👤 Role          : admin');
    console.log('  🆔 MongoDB ID    :', admin._id.toString());
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ You can now log in at http://localhost:5173/login\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    process.exit(1);
  }
}

createAdmin();
