import mongoose from "mongoose";

const connectDb = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log(` MongoDB Connected : ${mongoose.connection.host}`)
  } catch (error) {
    console.log(`❌ Error connecting to MongoDB: ${error.message}`)
    process.exit(1)
  }
}
export default connectDb;



