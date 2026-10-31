import Booking from "../model/booking.model.js";
import Listing from "../model/listing.model.js";
import User from "../model/user.model.js";

/**
 * Automatically syncs expired bookings:
 * 1. Identifies bookings whose checkOut date has passed.
 * 2. Marks them as "completed".
 * 3. Removes the listing from the guest's active booking list (My Bookings).
 * 4. Clears `isBooked: false` on listings that have no remaining active bookings.
 */
export const syncExpiredBookings = async () => {
  try {
    const now = new Date();

    // Step 1: Find all active bookings whose check-out date has passed
    const expiredBookings = await Booking.find({
      status: "booked",
      checkOut: { $lte: now },
    });

    if (expiredBookings.length > 0) {
      // Mark them as completed
      const expiredBookingIds = expiredBookings.map((b) => b._id);
      await Booking.updateMany(
        { _id: { $in: expiredBookingIds } },
        { status: "completed" }
      );

      // Remove expired listings from guests' `booking` array
      for (const booking of expiredBookings) {
        if (booking.guest && booking.listing) {
          // Check if guest has any other future active booking for this property
          const hasRemainingBooking = await Booking.exists({
            guest: booking.guest,
            listing: booking.listing,
            status: "booked",
            checkOut: { $gt: now },
          });

          if (!hasRemainingBooking) {
            await User.findByIdAndUpdate(booking.guest, {
              $pull: { booking: booking.listing },
            });
          }
        }
      }
    }

    // Step 2: Global Listing cleanup
    // Find all listings currently marked as `isBooked: true`
    const bookedListings = await Listing.find({ isBooked: true }).select("_id");

    for (const listing of bookedListings) {
      // Check if there is any active booking where checkOut is in the future
      const hasActiveFutureBooking = await Booking.exists({
        listing: listing._id,
        status: "booked",
        checkOut: { $gt: now },
      });

      // If no active future booking exists, remove the booked sign
      if (!hasActiveFutureBooking) {
        await Listing.findByIdAndUpdate(listing._id, {
          isBooked: false,
          guest: null,
        });
      }
    }
  } catch (error) {
    console.error("syncExpiredBookings error:", error);
  }
};
