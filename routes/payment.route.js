import express from "express";
import isAuth from "../middleware/isAuth.js";
import {
  createRazorpayOrder,
  verifyPayment,
  getRazorpayKey,
  getMyPayments,
  getPaymentById,
} from "../controllers/payment.controller.js";

const paymentRouter = express.Router();

// Get Razorpay public key
paymentRouter.get("/key", isAuth, getRazorpayKey);

// Create order for checkout
paymentRouter.post("/create-order", isAuth, createRazorpayOrder);

// Verify payment signature
paymentRouter.post("/verify-payment", isAuth, verifyPayment);

// Payment history for the logged-in user
paymentRouter.get("/my-payments", isAuth, getMyPayments);

// Get single payment details
paymentRouter.get("/:id", isAuth, getPaymentById);

export default paymentRouter;
