import mongoose from "mongoose";
import dns from "node:dns";

// Resolve querySrv EBADRESP issues on Windows/ISP DNS
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const connectDb = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(` MongoDB Connected : ${mongoose.connection.host}`);
  } catch (error) {
    console.log(`❌ Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};
export default connectDb;



