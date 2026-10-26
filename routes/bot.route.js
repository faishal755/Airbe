import express from "express";
import { chatWithBot } from "../controllers/bot.controller.js";

const botRouter = express.Router();

botRouter.post("/chat", chatWithBot);

export default botRouter;
