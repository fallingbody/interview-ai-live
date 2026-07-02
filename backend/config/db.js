import mongoose from "mongoose";

let cachedConnection = null;

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return mongoose.connection;
  if (cachedConnection) return cachedConnection;

  try {
    cachedConnection = mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 300, // Ensure enough connections for 150+ concurrent active users
    });
    await cachedConnection;
    console.log("MongoDB Connected Successfully");
    return mongoose.connection;
  } catch (err) {
    console.error("MongoDB Connection Error:", err.message);
    cachedConnection = null;
    throw err;
  }
};

export default connectDB;