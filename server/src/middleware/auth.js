import jwt from "jsonwebtoken";
import Student from "../models/Student.js";

export function createSession(studentId, res) {
  const token = jwt.sign({ sub: studentId.toString() }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.cookie("deadline_radar_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/"
  });
}

export async function requireAuth(req, res, next) {
  const token = req.cookies?.deadline_radar_session;
  if (!token) return res.status(401).json({ error: "Please log in to continue." });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (typeof payload === "string" || typeof payload.sub !== "string") {
      return res.status(401).json({ error: "Your session is invalid. Please log in again." });
    }
    const student = await Student.findById(payload.sub);
    if (!student) return res.status(401).json({ error: "Your account could not be found. Please log in again." });
    req.student = student;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Your session has expired. Please log in again." });
    }
    next(error);
  }
}
