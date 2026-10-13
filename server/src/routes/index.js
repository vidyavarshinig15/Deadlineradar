import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Student from "../models/Student.js";
import Assignment from "../models/Assignment.js";
import StudySession from "../models/StudySession.js";
import { getRisk } from "../utils/risk.js";
import { createSession, requireAuth } from "../middleware/auth.js";

const router = Router();
const assignmentInput = z.object({
  title: z.string().trim().min(1).max(140),
  subject: z.string().trim().min(1).max(100),
  description: z.string().max(2000).optional().default(""),
  dueDate: z.coerce.date(),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  estimatedHours: z.coerce.number().min(0.25).max(500),
  completionPercentage: z.coerce.number().int().min(0).max(100).default(0),
  status: z.enum(["Pending", "In Progress", "Completed"]).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).optional().default([]),
  checklist: z.array(z.object({ _id: z.string().optional(), text: z.string().trim().min(1).max(160), completed: z.boolean().default(false) })).max(40).optional().default([])
}).strict();
const sessionInput = z.object({
  assignmentId: z.string().refine(mongoose.isValidObjectId, "Choose a valid assignment."),
  sessionDate: z.coerce.date().optional(),
  durationMinutes: z.coerce.number().int().min(1).max(1440),
  notes: z.string().max(1000).optional().default("")
}).strict();
const studentInput = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  department: z.string().trim().max(100).optional().default("Computer Science Engineering"),
  semester: z.coerce.number().int().min(1).max(12)
}).strict();
const credentialsInput = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must be 72 bytes or fewer.")
}).strict();

async function saveAssignment(payload, studentId, existing) {
  const data = assignmentInput.parse(payload);
  data.status = data.completionPercentage === 100 ? "Completed" : data.completionPercentage > 0 ? "In Progress" : (data.status === "Completed" ? "Pending" : data.status ?? "Pending");
  const risk = getRisk(data);
  const record = existing ?? new Assignment({ studentId });
  Object.assign(record, data, risk, { studentId });
  await record.save();
  return record;
}

function publicStudent(student) {
  return student.toJSON();
}

router.post("/auth/signup", async (req, res) => {
  const data = credentialsInput.parse(req.body);
  if (!data.name) return res.status(400).json({ error: "Name is required to create an account." });
  const existing = await Student.exists({ email: data.email.toLowerCase() });
  if (existing) return res.status(409).json({ error: "An account with this email already exists." });
  const student = await Student.create({
    name: data.name,
    email: data.email.toLowerCase(),
    passwordHash: await bcrypt.hash(data.password, 12)
  });
  createSession(student._id, res);
  res.status(201).json(publicStudent(student));
});
router.post("/auth/login", async (req, res) => {
  const data = credentialsInput.omit({ name: true }).parse(req.body);
  const student = await Student.findOne({ email: data.email.toLowerCase() }).select("+passwordHash");
  if (!student || !student.passwordHash || !await bcrypt.compare(data.password, student.passwordHash)) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }
  createSession(student._id, res);
  res.json(publicStudent(student));
});
router.post("/auth/logout", (req, res) => {
  res.clearCookie("deadline_radar_session", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  res.status(204).end();
});
router.use(requireAuth);

router.get("/auth/me", async (req, res) => res.json(publicStudent(req.student)));
router.get("/students/me", async (req, res) => res.json(req.student));
router.put("/students/me", async (req, res) => {
  const student = req.student;
  Object.assign(student, studentInput.parse(req.body));
  await student.save();
  res.json(student);
});

router.get("/assignments", async (req, res) => {
  const student = req.student;
  const filter = { studentId: student._id };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.subject) filter.subject = req.query.subject;
  if (req.query.difficulty) filter.difficulty = req.query.difficulty;
  if (req.query.riskLevel) filter.riskLevel = req.query.riskLevel;
  if (req.query.search) filter.$or = [{ title: new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }, { subject: new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }];
  if (req.query.time === "overdue") filter.dueDate = { $lt: new Date() }, filter.status = { $ne: "Completed" };
  if (req.query.time === "upcoming") filter.dueDate = { $gte: new Date(), $lte: new Date(Date.now() + 7 * 86400000) }, filter.status = { $ne: "Completed" };
  const sortBy = { dueDate: { dueDate: 1 }, progress: { completionPercentage: -1 }, risk: { riskScore: -1 } }[req.query.sort] ?? { dueDate: 1 };
  const assignments = await Assignment.find(filter).sort(sortBy);
  res.json(assignments);
});
router.get("/assignments/:id", async (req, res) => {
  const record = await Assignment.findOne({ _id: req.params.id, studentId: req.student._id }).populate("studentId", "name email");
  if (!record) return res.status(404).json({ error: "Assignment not found." });
  res.json(record);
});
router.post("/assignments", async (req, res) => {
  const record = await saveAssignment(req.body, req.student._id);
  res.status(201).json(record);
});
router.put("/assignments/:id", async (req, res) => {
  const record = await Assignment.findOne({ _id: req.params.id, studentId: req.student._id });
  if (!record) return res.status(404).json({ error: "Assignment not found." });
  res.json(await saveAssignment(req.body, record.studentId, record));
});
router.delete("/assignments/:id", async (req, res) => {
  const record = await Assignment.findOne({ _id: req.params.id, studentId: req.student._id });
  if (!record) return res.status(404).json({ error: "Assignment not found." });
  await StudySession.deleteMany({ assignmentId: record._id, studentId: record.studentId });
  await record.deleteOne();
  res.status(204).end();
});

router.get("/study-sessions", async (req, res) => {
  const student = req.student;
  const sessions = await StudySession.find({ studentId: student._id }).populate("assignmentId", "title subject").sort({ sessionDate: -1 }).limit(100);
  res.json(sessions);
});
router.post("/study-sessions", async (req, res) => {
  const student = req.student;
  const data = sessionInput.parse(req.body);
  const assignment = await Assignment.findOne({ _id: data.assignmentId, studentId: student._id });
  if (!assignment) return res.status(400).json({ error: "The selected assignment does not exist." });
  const session = await StudySession.create({ ...data, studentId: student._id });
  await session.populate("assignmentId", "title subject");
  res.status(201).json(session);
});
router.put("/study-sessions/:id", async (req, res) => {
  const student = req.student;
  const data = sessionInput.parse(req.body);
  const assignment = await Assignment.findOne({ _id: data.assignmentId, studentId: student._id });
  if (!assignment) return res.status(400).json({ error: "The selected assignment does not exist." });
  const session = await StudySession.findOneAndUpdate({ _id: req.params.id, studentId: student._id }, data, { new: true, runValidators: true }).populate("assignmentId", "title subject");
  if (!session) return res.status(404).json({ error: "Study session not found." });
  res.json(session);
});
router.delete("/study-sessions/:id", async (req, res) => {
  const session = await StudySession.findOneAndDelete({ _id: req.params.id, studentId: req.student._id });
  if (!session) return res.status(404).json({ error: "Study session not found." });
  res.status(204).end();
});

router.get("/analytics/dashboard", async (req, res) => {
  const student = req.student;
  const [result] = await Assignment.aggregate([
    { $match: { studentId: student._id } },
    { $facet: {
      statusCounts: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
      riskCounts: [{ $group: { _id: "$riskLevel", count: { $sum: 1 } } }],
      subjects: [{ $group: { _id: "$subject", count: { $sum: 1 }, estimatedHours: { $sum: "$estimatedHours" }, averageCompletion: { $avg: "$completionPercentage" } } }, { $sort: { estimatedHours: -1 } }],
      urgent: [{ $match: { status: { $ne: "Completed" } } }, { $sort: { riskScore: -1, dueDate: 1 } }, { $limit: 5 }, { $project: { title: 1, subject: 1, status: 1, difficulty: 1, estimatedHours: 1, dueDate: 1, riskScore: 1, riskLevel: 1, completionPercentage: 1, riskExplanation: 1 } }],
      totals: [{ $group: { _id: null, total: { $sum: 1 }, averageCompletion: { $avg: "$completionPercentage" } } }]
    } }
  ]);
  const overdue = await Assignment.countDocuments({ studentId: student._id, status: { $ne: "Completed" }, dueDate: { $lt: new Date() } });
  res.json({ ...(result ?? { statusCounts: [], riskCounts: [], subjects: [], urgent: [], totals: [] }), overdue });
});
router.get("/analytics/subjects", async (req, res) => {
  const student = req.student;
  const match = { studentId: student._id };
  if (req.query.subject) match.subject = String(req.query.subject);
  const rows = await Assignment.aggregate([
    { $match: match },
    { $lookup: { from: StudySession.collection.name, localField: "_id", foreignField: "assignmentId", as: "sessions" } },
    { $project: { title: 1, subject: 1, status: 1, difficulty: 1, dueDate: 1, riskLevel: 1, riskScore: 1, completionPercentage: 1, estimatedHours: 1, studyMinutes: { $sum: "$sessions.durationMinutes" } } },
    { $sort: { dueDate: 1 } }
  ]);
  res.json(rows);
});
router.get("/analytics/study-time", async (req, res) => {
  const student = req.student;
  const rows = await StudySession.aggregate([
    { $match: { studentId: student._id } },
    { $group: { _id: { $dateToString: { format: "%G-W%V", date: "$sessionDate" } }, minutes: { $sum: "$durationMinutes" }, sessions: { $sum: 1 } } },
    { $sort: { _id: 1 } }, { $project: { _id: 0, week: "$_id", minutes: 1, hours: { $round: [{ $divide: ["$minutes", 60] }, 1] }, sessions: 1 } }
  ]);
  const byAssignment = await StudySession.aggregate([
    { $match: { studentId: student._id } },
    { $group: { _id: "$assignmentId", minutes: { $sum: "$durationMinutes" } } },
    { $lookup: { from: Assignment.collection.name, localField: "_id", foreignField: "_id", as: "assignment" } },
    { $unwind: "$assignment" }, { $project: { _id: 0, title: "$assignment.title", subject: "$assignment.subject", minutes: 1 } },
    { $sort: { minutes: -1 } }
  ]);
  res.json({ weekly: rows, byAssignment, totalMinutes: byAssignment.reduce((sum, row) => sum + row.minutes, 0) });
});

router.get("/analytics/checklist", async (req, res) => {
  const student = req.student;
  const rows = await Assignment.aggregate([
    { $match: { studentId: student._id } },
    { $unwind: "$checklist" },
    { $group: { _id: "$subject", total: { $sum: 1 }, completed: { $sum: { $cond: ["$checklist.completed", 1, 0] } } } },
    { $project: { subject: "$_id", _id: 0, total: 1, completed: 1 } }, { $sort: { subject: 1 } }
  ]);
  res.json(rows);
});

export default router;
