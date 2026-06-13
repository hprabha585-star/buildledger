const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/construction_app';

const connect = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected:', MONGO_URI);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = { connect, mongoose };
