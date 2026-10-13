import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

const studentSchema = new mongoose.Schema({
  profileKey: { type: String, required: true, default: randomUUID, immutable: true, unique: true, select: false },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, unique: true },
  passwordHash: { type: String, required: true, select: false },
  department: { type: String, trim: true, default: "Computer Science Engineering" },
  semester: { type: Number, min: 1, max: 12, default: 8 }
}, {
  timestamps: true,
  toJSON: {
    transform(_document, result) {
      delete result.passwordHash;
      delete result.profileKey;
      return result;
    }
  }
});

export default mongoose.model("Student", studentSchema);
