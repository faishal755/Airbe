import dotenv from "dotenv"
dotenv.config()
import cookieParser from "cookie-parser";
import logger from "./logger.js";
import express from "express";
import connectDb from "./config/db.js";
import authRouter from "./routes/auth.route.js";
import cors from "cors"
import userRouter from "./routes/user.route.js";
import listingRouter from "./routes/listing.route.js";
import bookingRouter from "./routes/booking.route.js";

let port = process.env.PORT || 6000;

let app = express();
app.use(cors({
  origin: true,
  credentials: true
}))
app.use(express.json())
app.use(logger)
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser())


app.get('/health', (req, res) => {
  return (
    res.json('success')
  )
})

app.use("/api/auth", authRouter)
app.use("/api/user", userRouter)
app.use("/api/listing", listingRouter)
app.use("/api/booking", bookingRouter)




console.log("URGENT CHECK:", process.env.MONGO_URI);
connectDb()

app.listen(port, () => {
  console.log(`server started at http://localhost:${port}`)
})
