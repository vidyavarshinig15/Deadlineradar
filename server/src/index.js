import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import routes from "./routes/index.js";
import { errorHandler, notFound } from "./middleware/errors.js";

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.get("/api/health", (req, res) => res.json({ status: "ok", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" }));
app.use("/api", routes);
app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT ?? 4000);
try {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not configured. Copy .env.example to .env and set a MongoDB connection URI.");
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters. Add a private random value to server/.env.");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  console.log(`MongoDB connected: ${mongoose.connection.name}`);
  app.listen(port, () => console.log(`Deadline Radar API listening on http://localhost:${port}`));
} catch (error) {
  console.error(`Could not start Deadline Radar: ${error.message}`);
  process.exitCode = 1;
}
