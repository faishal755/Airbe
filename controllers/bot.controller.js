import Listing from "../model/listing.model.js";

// AI Concierge Bot Controller
export const chatWithBot = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "Query message is required" });
    }

    const query = message.toLowerCase().trim();

    // Check for budget in query
    let maxRent = null;
    const underMatch = query.match(/(?:under|below|less than|max)\s*(?:rs\.?|inr|₹)?\s*(\d+[\d,]*)/i);
    if (underMatch) {
      maxRent = parseInt(underMatch[1].replace(/,/g, ""), 10);
    } else if (/(?:budget|cheap|affordable)/i.test(query)) {
      maxRent = 4000;
    }

    // Build MongoDB query
    const searchFilter = {};
    const orConditions = [];

    // Extract potential search words
    const tokens = query
      .replace(/[^\w\s]/gi, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !["show", "find", "best", "want", "need", "place", "stays", "with", "from", "looking"].includes(w));

    if (tokens.length > 0) {
      for (const token of tokens) {
        orConditions.push(
          { city: { $regex: token, $options: "i" } },
          { landmark: { $regex: token, $options: "i" } },
          { category: { $regex: token, $options: "i" } },
          { title: { $regex: token, $options: "i" } }
        );
      }
    }

    if (orConditions.length > 0) {
      searchFilter.$or = orConditions;
    }

    if (maxRent) {
      searchFilter.rent = { $lte: maxRent };
    }

    // Find listings from database
    let matchingListings = [];
    if (orConditions.length > 0) {
      matchingListings = await Listing.find(searchFilter).limit(4);
    }

    // If no direct matches, return top-rated listings
    if (matchingListings.length === 0) {
      matchingListings = await Listing.find().sort({ rating: -1 }).limit(3);
    }

    return res.status(200).json({
      success: true,
      reply: `Here are matching listings found in our database:`,
      listings: matchingListings,
    });
  } catch (error) {
    console.error("Bot chat error:", error);
    return res.status(500).json({ success: false, message: `Bot error: ${error.message}` });
  }
};
