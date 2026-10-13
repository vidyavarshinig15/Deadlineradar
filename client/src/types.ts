export type Assignment = {
  _id: string;
  title: string;
  subject: string;
  description: string;
  dueDate: string;
  difficulty: "Easy" | "Medium" | "Hard";
  estimatedHours: number;
  completionPercentage: number;
  status: "Pending" | "In Progress" | "Completed";
  riskScore: number;
  riskLevel: "Low" | "Medium" | "High" | "Completed";
  riskExplanation: string;
  tags: string[];
  checklist: { _id: string; text: string; completed: boolean }[];
};
export type StudySession = {
  _id: string;
  assignmentId: { _id: string; title: string; subject: string };
  sessionDate: string;
  durationMinutes: number;
  notes: string;
};
export type Student = { name: string; email: string; department: string; semester: number };
