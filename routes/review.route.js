import express from "express";
import isAuth from "../middleware/isAuth.js";
import { addReview, getListingReviews, deleteReview } from "../controllers/review.controller.js";

const reviewRouter = express.Router();

reviewRouter.post("/add/:id", isAuth, addReview);
reviewRouter.get("/listing/:id", getListingReviews);
reviewRouter.delete("/delete/:id", isAuth, deleteReview);

export default reviewRouter;
