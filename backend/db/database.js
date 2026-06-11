const mongoose = require('mongoose');

const connect = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/buildledger';
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = { connect, mongoose };
