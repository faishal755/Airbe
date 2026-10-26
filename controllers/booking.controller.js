import Listing from "../model/listing.model.js";
import User from "../model/user.model.js";
import Booking from "../model/booking.model.js";

// 1. Create booking with robust date-range overlap validation
export const createBooking = async (req, res) => {
  try {
    let { id } = req.params;
    let { checkIn, checkOut, totalRent } = req.body;

    if (!checkIn || !checkOut) {
      return res.status(400).json({ message: "Please select both check-in and check-out dates" });
    }

    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);
    if (isNaN(inDate.getTime()) || isNaN(outDate.getTime()) || inDate >= outDate) {
      return res.status(400).json({ message: "Invalid check-in or check-out date" });
    }

    // Check if check-in is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (inDate < today) {
      return res.status(400).json({ message: "Check-in date cannot be in the past" });
    }

    let listing = await Listing.findById(id);
    if (!listing) {
      return res.status(404).json({ message: "Listing not found" });
    }

    if (String(listing.host) === String(req.userId)) {
      return res.status(400).json({ message: "You cannot book your own listing" });
    }

    // Overlap validation: prevent double-booking for the requested date interval
    const overlappingBooking = await Booking.findOne({
      listing: id,
      status: "booked",
      $or: [
        { checkIn: { $lte: inDate }, checkOut: { $gt: inDate } },
        { checkIn: { $lt: outDate }, checkOut: { $gte: outDate } },
        { checkIn: { $gte: inDate }, checkOut: { $lte: outDate } },
      ],
    });

    if (overlappingBooking) {
      return res.status(400).json({
        message: "This property is already reserved for the selected dates. Please choose different dates.",
        conflictingRange: {
          checkIn: overlappingBooking.checkIn,
          checkOut: overlappingBooking.checkOut,
        },
      });
    }

    // Ensure totalRent is positive
    const finalRent =
      Number(totalRent) > 0 ? Number(totalRent) : Number(listing.rent) || 1000;

    let booking = await Booking.create({
      checkIn: inDate,
      checkOut: outDate,
      totalRent: finalRent,
      host: listing.host,
      guest: req.userId,
      listing: listing._id,
      status: "booked",
    });

    try {
      await booking.populate("host", "email name");
    } catch (e) {
      console.log("Host populate notice:", e.message);
    }

    await User.findByIdAndUpdate(
      req.userId,
      { $addToSet: { booking: listing._id } },
      { new: true }
    );

    listing.guest = req.userId;
    listing.isBooked = true;
    await listing.save();

    return res.status(201).json(booking);
  } catch (error) {
    console.error("Booking creation error:", error);
    return res.status(500).json({ message: error.message || "Failed to create booking" });
  }
};

// 2. Cancel a booking
export const cancelBooking = async (req, res) => {
  try {
    let { id } = req.params;
    let userId = req.userId;

    // Find and update the active booking for this listing and user
    const booking = await Booking.findOneAndUpdate(
      { listing: id, guest: userId, status: "booked" },
      { status: "cancel" },
      { new: true }
    );

    // Pull from user's booking array
    await User.findByIdAndUpdate(
      userId,
      { $pull: { booking: id } },
      { new: true }
    );

    // Check if there are any remaining active bookings for this listing
    const remainingActiveBookings = await Booking.countDocuments({
      listing: id,
      status: "booked",
      checkOut: { $gt: new Date() },
    });

    if (remainingActiveBookings === 0) {
      await Listing.findByIdAndUpdate(id, { isBooked: false, guest: null });
    }

    return res.status(200).json({
      message: "Booking cancelled successfully",
      bookingId: booking?._id,
    });
  } catch (error) {
    console.error("Cancel booking error:", error);
    return res.status(500).json({ message: "Failed to cancel booking" });
  }
};

// 3. Get all booked date ranges for a listing (Availability API)
export const getBookedDates = async (req, res) => {
  try {
    const { id } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeBookings = await Booking.find({
      listing: id,
      status: "booked",
      checkOut: { $gte: today },
    }).select("checkIn checkOut");

    return res.status(200).json({
      success: true,
      bookedDates: activeBookings.map((b) => ({
        checkIn: b.checkIn,
        checkOut: b.checkOut,
      })),
    });
  } catch (error) {
    console.error("Get booked dates error:", error);
    return res.status(500).json({ message: `Availability error: ${error.message}` });
  }
};
