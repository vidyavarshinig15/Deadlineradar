const DAY_MS = 24 * 60 * 60 * 1000;

export function getRisk(assignment, now = new Date()) {
  const completion = Number(assignment.completionPercentage ?? 0);
  if (assignment.status === "Completed" || completion === 100) {
    return {
      riskScore: 0,
      riskLevel: "Completed",
      riskExplanation: "Completed — no remaining work to put at risk.",
      daysRemaining: Math.ceil((new Date(assignment.dueDate).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / DAY_MS)
    };
  }

  const dueDate = new Date(assignment.dueDate);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(dueDate);
  dueDay.setHours(0, 0, 0, 0);
  const daysRemaining = Math.ceil((dueDay.getTime() - today.getTime()) / DAY_MS);
  const overdue = dueDate.getTime() < new Date(now).getTime();
  const deadlinePoints = overdue ? 40 : daysRemaining > 7 ? 5 : daysRemaining >= 4 ? 15 : daysRemaining >= 2 ? 25 : 40;
  const difficultyPoints = { Easy: 10, Medium: 20, Hard: 30 }[assignment.difficulty] ?? 10;
  const remainingPoints = ((100 - completion) / 100) * 30;
  const riskScore = Math.max(0, Math.min(100, Math.round(deadlinePoints + difficultyPoints + remainingPoints)));
  const riskLevel = riskScore <= 30 ? "Low" : riskScore <= 60 ? "Medium" : "High";
  const timing = overdue ? daysRemaining === 0 ? "deadline passed today" : `${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? "" : "s"} overdue` : daysRemaining === 0 ? "due today" : daysRemaining === 1 ? "due tomorrow" : `due in ${daysRemaining} days`;
  const riskExplanation = `${riskLevel} risk: This ${assignment.difficulty.toLowerCase()} assignment is ${timing} and is ${completion}% complete.`;

  return { riskScore, riskLevel, riskExplanation, daysRemaining };
}
