import dotenv from "dotenv";
dotenv.config();
import cookieParser from "cookie-parser";
import logger from "./logger.js";
import express from "express";
import connectDb from "./config/db.js";
import authRouter from "./routes/auth.route.js";
import cors from "cors";
import userRouter from "./routes/user.route.js";
import listingRouter from "./routes/listing.route.js";
import bookingRouter from "./routes/booking.route.js";
import botRouter from "./routes/bot.route.js";
import reviewRouter from "./routes/review.route.js";
import paymentRouter from "./routes/payment.route.js";
import rateLimit from "express-rate-limit";
import { syncExpiredBookings } from "./utils/syncBookings.js";

let port = process.env.PORT || 6000;

let app = express();
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(logger);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Auth limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login/signup attempts from this IP, please try again after 15 minutes.",
  },
});

app.get("/health", (req, res) => {
  return res.json("success");
});

app.use("/api/auth", authLimiter, authRouter);
app.use("/api/user", userRouter);
app.use("/api/listing", listingRouter);
app.use("/api/booking", bookingRouter);
app.use("/api/bot", botRouter);
app.use("/api/review", reviewRouter);
app.use("/api/payment", paymentRouter);

connectDb().then(() => {
  // Sync expired bookings immediately after DB connection
  syncExpiredBookings();
  // Continuously check and remove expired bookings every 60 seconds
  setInterval(syncExpiredBookings, 60 * 1000);
});

app.listen(port, () => {
  console.log(`server started at http://localhost:${port}`);
});
