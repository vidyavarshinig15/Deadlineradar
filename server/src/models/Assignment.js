import mongoose from "mongoose";

const checklistItemSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true, maxlength: 160 },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const assignmentSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 140 },
  subject: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 2000, default: "" },
  dueDate: { type: Date, required: true, index: true },
  difficulty: { type: String, required: true, enum: ["Easy", "Medium", "Hard"] },
  estimatedHours: { type: Number, required: true, min: 0.25, max: 500 },
  completionPercentage: { type: Number, min: 0, max: 100, default: 0 },
  status: { type: String, enum: ["Pending", "In Progress", "Completed"], default: "Pending", index: true },
  riskScore: { type: Number, min: 0, max: 100, default: 0 },
  riskLevel: { type: String, enum: ["Low", "Medium", "High", "Completed"], default: "Low", index: true },
  riskExplanation: { type: String, default: "" },
  tags: { type: [String], default: [] },
  checklist: { type: [checklistItemSchema], default: [] }
}, { timestamps: true });

assignmentSchema.index({ studentId: 1, dueDate: 1 });
assignmentSchema.index({ studentId: 1, status: 1, riskLevel: 1 });
assignmentSchema.pre("validate", function () {
  if (this.completionPercentage === 100) this.status = "Completed";
  else if (this.status === "Completed") this.invalidate("completionPercentage", "Completed assignments must be 100% complete.");
  else if (this.completionPercentage > 0 && this.status === "Pending") this.status = "In Progress";
});

export default mongoose.model("Assignment", assignmentSchema);
