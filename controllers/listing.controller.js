import uploadCloudinary from "../config/cloudinary.js";
import Listing from "../model/listing.model.js";
import User from "../model/user.model.js";
import { syncExpiredBookings } from "../utils/syncBookings.js";

export const addListing = async (req, res) => {
  try {
    let host = req.userId;
    let { title, description, rent, city, landmark, category } = req.body;
    let parsedRent = Number(rent);
    console.log("req.files", req.files);
    let image1 = await uploadCloudinary(req.files.image1[0].path);
    let image2 = await uploadCloudinary(req.files.image2[0].path);
    let image3 = await uploadCloudinary(req.files.image3[0].path);
    console.log("image1,", image1);
    console.log("image2,", image2);
    console.log("image3,", image3);
    let listing = await Listing.create({
      title,
      description,
      rent: parsedRent,
      city,
      landmark,
      category,
      image1,
      image2,
      image3,
      host,
    });
    let user = await User.findByIdAndUpdate(
      host,
      { $push: { listing: listing._id } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "user is not found" });
    }

    return res.status(201).json(listing);
  } catch (error) {
    return res.status(500).json({ message: `AddListing error ${error}` });
  }
};

export const getListing = async (req, res) => {
  try {
    // Clean up any bookings whose checkout date has passed before listing
    await syncExpiredBookings();
    let listing = await Listing.find().sort({ createdAt: -1 });
    return res.status(200).json(listing);
  } catch (error) {
    return res.status(500).json({ message: `getListing error ${error}` });
  }
};

export const findListing = async (req, res) => {
  try {
    let { id } = req.params;
    await syncExpiredBookings();
    let listing = await Listing.findById(id);
    if (!listing) {
      return res.status(404).json({ message: "listing not found" });
    }
    return res.status(200).json(listing);
  } catch (error) {
    return res.status(500).json({ message: `findListing error ${error}` });
  }
};

export const updateListing = async (req, res) => {
  try {
    let image1;
    let image2;
    let image3;
    let { id } = req.params;
    let { title, description, rent, city, landmark, category } = req.body;
    let parsedRent = Number(rent);
    if (req.files.image1) {
      image1 = await uploadCloudinary(req.files.image1[0].path);
    }
    if (req.files.image2) {
      image2 = await uploadCloudinary(req.files.image2[0].path);
    }
    if (req.files.image3) {
      image3 = await uploadCloudinary(req.files.image3[0].path);
    }
    let listing = await Listing.findByIdAndUpdate(
      id,
      {
        title,
        description,
        rent: parsedRent,
        city,
        landmark,
        category,
        image1,
        image2,
        image3,
      },
      { new: true }
    );

    return res.status(201).json(listing);
  } catch (error) {
    return res.status(500).json({ message: `UpdateListing Error ${error}` });
  }
};

export const deleteListing = async (req, res) => {
  try {
    let { id } = req.params;
    let listing = await Listing.findByIdAndDelete(id);
    let user = await User.findByIdAndUpdate(
      listing.host,
      {
        $pull: { listing: listing._id },
      },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }
    return res.status(201).json({ message: "Listing deleted" });
  } catch (error) {
    return res.status(500).json({ message: `DeleteListing Error ${error}` });
  }
};

export const ratingListing = async (req, res) => {
  try {
    let { id } = req.params;
    let { rating } = req.body;
    let listing = await Listing.findById(id);
    if (!listing) {
      return res.status(404).json({ message: "listing not found" });
    }
    listing.rating = Number(rating);
    await listing.save();
    return res.status(200).json({ rating: listing.rating });
  } catch (error) {
    return res.status(500).json({ message: `Rating error ${error}` });
  }
};

export const search = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const listing = await Listing.find({
      $or: [
        { landmark: { $regex: query, $options: "i" } },
        { city: { $regex: query, $options: "i" } },
        { title: { $regex: query, $options: "i" } },
      ],
    });

    return res.status(200).json(listing);
  } catch (error) {
    console.log("Search error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
