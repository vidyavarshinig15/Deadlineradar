import mongoose from "mongoose";

const studySessionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", required: true, index: true },
  sessionDate: { type: Date, required: true, default: Date.now },
  durationMinutes: { type: Number, required: true, min: 1, max: 1440 },
  notes: { type: String, trim: true, maxlength: 1000, default: "" }
}, { timestamps: true });

studySessionSchema.index({ studentId: 1, sessionDate: -1 });

export default mongoose.model("StudySession", studySessionSchema);
