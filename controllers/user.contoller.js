import User from "../model/user.model.js";
import { syncExpiredBookings } from "../utils/syncBookings.js";

export const getCurrentUser = async (req, res) => {
  try {
    // Automatically clean up any bookings whose checkOut date has passed
    await syncExpiredBookings();

    let user = await User.findById(req.userId)
      .select("-password")
      .populate(
        "listing",
        "title image1 image2 image3 description rent category city landmark isBooked host rating"
      )
      .populate(
        "booking",
        "title image1 image2 image3 description rent category city landmark isBooked host rating"
      );

    if (!user) {
      return res.status(400).json({ message: "user not found" });
    }

    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ message: `getCurrentUser error ${error}` });
  }
};
