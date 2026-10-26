import Review from "../model/review.model.js";
import Listing from "../model/listing.model.js";

// Helper function to recompute review aggregation for a listing
const updateListingRating = async (listingId) => {
  const reviews = await Review.find({ listing: listingId });
  if (reviews.length === 0) {
    await Listing.findByIdAndUpdate(listingId, { rating: 0, reviewCount: 0 });
    return { averageRating: 0, reviewCount: 0 };
  }

  const sum = reviews.reduce((acc, curr) => acc + Number(curr.rating), 0);
  const avg = Number((sum / reviews.length).toFixed(2));

  await Listing.findByIdAndUpdate(listingId, {
    rating: avg,
    reviewCount: reviews.length,
  });

  return { averageRating: avg, reviewCount: reviews.length };
};

// 1. Add a review with rating & written feedback
export const addReview = async (req, res) => {
  try {
    const { id: listingId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.userId;

    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ message: "Rating must be a number between 1 and 5" });
    }

    if (!comment || !comment.trim()) {
      return res.status(400).json({ message: "Review comment cannot be empty" });
    }

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: "Listing not found" });
    }

    // Create review
    const review = await Review.create({
      listing: listingId,
      user: userId,
      rating: Number(rating),
      comment: comment.trim(),
    });

    await review.populate("user", "name email");

    // Recompute aggregate average rating
    const { averageRating, reviewCount } = await updateListingRating(listingId);

    return res.status(201).json({
      success: true,
      message: "Review added successfully",
      review,
      averageRating,
      reviewCount,
    });
  } catch (error) {
    console.error("Add review error:", error);
    return res.status(500).json({ message: `Failed to add review: ${error.message}` });
  }
};

// 2. Get all reviews for a listing
export const getListingReviews = async (req, res) => {
  try {
    const { id: listingId } = req.params;

    const reviews = await Review.find({ listing: listingId })
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    const count = reviews.length;
    const avg =
      count > 0
        ? Number((reviews.reduce((acc, r) => acc + r.rating, 0) / count).toFixed(2))
        : 0;

    return res.status(200).json({
      success: true,
      reviews,
      reviewCount: count,
      averageRating: avg,
    });
  } catch (error) {
    console.error("Get reviews error:", error);
    return res.status(500).json({ message: `Failed to fetch reviews: ${error.message}` });
  }
};

// 3. Delete a review
export const deleteReview = async (req, res) => {
  try {
    const { id: reviewId } = req.params;
    const userId = req.userId;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (String(review.user) !== String(userId)) {
      return res.status(403).json({ message: "You are not authorized to delete this review" });
    }

    const listingId = review.listing;
    await Review.findByIdAndDelete(reviewId);

    const { averageRating, reviewCount } = await updateListingRating(listingId);

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
      averageRating,
      reviewCount,
    });
  } catch (error) {
    console.error("Delete review error:", error);
    return res.status(500).json({ message: `Failed to delete review: ${error.message}` });
  }
};
