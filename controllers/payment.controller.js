import crypto from "crypto";
import razorpay from "../config/razorpay.js";
import Payment from "../model/payment.model.js";
import Booking from "../model/booking.model.js";
import Listing from "../model/listing.model.js";
import User from "../model/user.model.js";

// 1. Get Razorpay Key (Public Key for Frontend)
export const getRazorpayKey = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Get Razorpay key error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve Razorpay public key",
    });
  }
};

// 2. Create Razorpay Order
export const createRazorpayOrder = async (req, res) => {
  try {
    const { amount, currency = "INR", listingId, bookingId, checkIn, checkOut } = req.body;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid positive amount is required to create an order",
      });
    }

    // Validate listing & host if listingId is provided
    if (listingId) {
      const listing = await Listing.findById(listingId);
      if (!listing) {
        return res.status(404).json({
          success: false,
          message: "Selected listing not found",
        });
      }

      if (String(listing.host) === String(req.userId)) {
        return res.status(400).json({
          success: false,
          message: "You cannot book your own listing",
        });
      }

      // Check date conflicts if checkIn & checkOut are provided
      if (checkIn && checkOut) {
        const inDate = new Date(checkIn);
        const outDate = new Date(checkOut);
        const overlapping = await Booking.findOne({
          listing: listingId,
          status: "booked",
          $or: [
            { checkIn: { $lte: inDate }, checkOut: { $gt: inDate } },
            { checkIn: { $lt: outDate }, checkOut: { $gte: outDate } },
            { checkIn: { $gte: inDate }, checkOut: { $lte: outDate } },
          ],
        });

        if (overlapping) {
          return res.status(400).json({
            success: false,
            message: "This property is already reserved for the selected dates",
          });
        }
      }
    }

    // Razorpay requires amount in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(Number(amount) * 100);
    const receipt = `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const options = {
      amount: amountInPaise,
      currency: currency.toUpperCase(),
      receipt,
      notes: {
        userId: req.userId ? String(req.userId) : "",
        listingId: listingId ? String(listingId) : "",
        bookingId: bookingId ? String(bookingId) : "",
      },
    };

    const order = await razorpay.orders.create(options);

    // Save pending payment record in DB
    const newPayment = await Payment.create({
      user: req.userId,
      listing: listingId || undefined,
      booking: bookingId || undefined,
      razorpayOrderId: order.id,
      amount: Number(amount),
      currency: order.currency,
      status: "created",
      receipt,
    });

    return res.status(201).json({
      success: true,
      order,
      paymentId: newPayment._id,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Razorpay create order error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create Razorpay order",
    });
  }
};

// 3. Verify Razorpay Payment Signature
export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingDetails, // Optional: { listingId, checkIn, checkOut, totalRent }
      bookingId,      // Optional: if booking already created as pending
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing required Razorpay payment credentials",
      });
    }

    // Generate expected HMAC SHA256 signature
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      await Payment.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        {
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          status: "failed",
        }
      );

      return res.status(400).json({
        success: false,
        message: "Payment verification failed: Invalid signature",
      });
    }

    // Payment is valid! Update payment record
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: "paid",
      },
      { new: true }
    );

    let confirmedBooking = null;

    // Case A: Existing booking ID provided -> update its payment status
    if (bookingId) {
      confirmedBooking = await Booking.findByIdAndUpdate(
        bookingId,
        {
          paymentStatus: "paid",
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
        },
        { new: true }
      );
      if (payment) {
        payment.booking = confirmedBooking?._id;
        await payment.save();
      }
    }
    // Case B: Booking details provided -> create confirmed booking upon payment
    else if (bookingDetails && bookingDetails.listingId) {
      const { listingId, checkIn, checkOut, totalRent } = bookingDetails;
      const inDate = new Date(checkIn);
      const outDate = new Date(checkOut);

      const listing = await Listing.findById(listingId);
      if (listing) {
        confirmedBooking = await Booking.create({
          checkIn: inDate,
          checkOut: outDate,
          totalRent: Number(totalRent) || listing.rent,
          host: listing.host,
          guest: req.userId,
          listing: listing._id,
          status: "booked",
          paymentStatus: "paid",
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
        });

        // Add booking to user's bookings list
        await User.findByIdAndUpdate(
          req.userId,
          { $addToSet: { booking: listing._id } },
          { new: true }
        );

        listing.guest = req.userId;
        listing.isBooked = true;
        await listing.save();

        if (payment) {
          payment.booking = confirmedBooking._id;
          payment.listing = listing._id;
          await payment.save();
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      payment,
      booking: confirmedBooking,
    });
  } catch (error) {
    console.error("Razorpay verify payment error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to verify Razorpay payment",
    });
  }
};

// 4. Get User's Payments History
export const getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.userId })
      .populate("listing", "title image1 rent city")
      .populate("booking")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      payments,
    });
  } catch (error) {
    console.error("Get my payments error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user payments",
    });
  }
};

// 5. Get Payment by ID
export const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findById(id)
      .populate("listing")
      .populate("booking")
      .populate("user", "name email");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    return res.status(200).json({
      success: true,
      payment,
    });
  } catch (error) {
    console.error("Get payment by ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment details",
    });
  }
};
