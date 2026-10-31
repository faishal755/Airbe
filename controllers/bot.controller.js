import Listing from "../model/listing.model.js";

// Google Gemini Free API Integration + Database Search Assistant
export const chatWithBot = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "Query message is required" });
    }

    const query = message.toLowerCase().trim();

    // 1. Budget extraction
    let maxRent = null;
    const underMatch = query.match(/(?:under|below|less than|max)\s*(?:rs\.?|inr|₹)?\s*(\d+[\d,]*)/i);
    if (underMatch) {
      maxRent = parseInt(underMatch[1].replace(/,/g, ""), 10);
    } else if (/(?:budget|cheap|affordable)/i.test(query)) {
      maxRent = 4000;
    }

    // 2. Query MongoDB for relevant listings
    const searchFilter = {};
    const orConditions = [];

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

    let matchingListings = [];
    if (orConditions.length > 0) {
      matchingListings = await Listing.find(searchFilter).limit(4);
    }

    if (matchingListings.length === 0) {
      matchingListings = await Listing.find().sort({ rating: -1 }).limit(3);
    }

    // 3. Check for Google Gemini Free API Key
    const geminiApiKey = process.env.GEMINI_API_KEY;
    let botReply = "";

    if (geminiApiKey && geminiApiKey.trim()) {
      try {
        const listingsContext = matchingListings
          .map(
            (l) =>
              `- ${l.title} in ${l.landmark || ""}, ${l.city} (${l.category}) at ₹${l.rent}/day (Rating: ${l.rating || 4.8})`
          )
          .join("\n");

        const prompt = `You are the friendly Airbnb Assistant for our vacation rental booking platform.
The user asked: "${message}".

Here are the real matching properties currently available in our database:
${listingsContext || "No exact matching properties found in database."}

Instructions:
1. Provide a warm, helpful, and concise response (2-4 sentences).
2. Recommend the matching properties from the list above if applicable.
3. If the user asks about booking, cancellations, or hosting, give clear practical guidance.
4. Keep the tone hospitable and professional.`;

        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`;

        const response = await fetch(geminiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 300,
              temperature: 0.7,
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          botReply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        } else {
          const errorData = await response.text();
          console.warn("Gemini API returned error, falling back to local reply:", errorData);
        }
      } catch (geminiError) {
        console.warn("Gemini API call failed, using fallback:", geminiError.message);
      }
    }

    // Default fallback if Gemini is not configured or failed
    if (!botReply) {
      if (matchingListings.length > 0) {
        botReply = `Here are matching listings found for your search:`;
      } else {
        botReply = `I couldn't find an exact match, but here are some of our top-rated stays:`;
      }
    }

    return res.status(200).json({
      success: true,
      reply: botReply,
      listings: matchingListings,
      poweredBy: geminiApiKey ? "Google Gemini API (Free Tier)" : "Local Search Engine",
    });
  } catch (error) {
    console.error("Bot chat error:", error);
    return res.status(500).json({ success: false, message: `Bot error: ${error.message}` });
  }
};
