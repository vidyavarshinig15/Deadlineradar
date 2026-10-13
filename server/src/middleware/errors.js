export function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.name === "ValidationError") {
    return res.status(400).json({ error: Object.values(error.errors).map((entry) => entry.message).join(" ") });
  }
  if (error.name === "CastError") return res.status(400).json({ error: "The requested record ID is invalid." });
  if (error.code === 11000) return res.status(409).json({ error: "A record with these unique values already exists." });
  if (error.name === "ZodError") return res.status(400).json({ error: error.issues.map((issue) => issue.message).join(" ") });
  console.error(error);
  res.status(error.status ?? 500).json({ error: error.status ? error.message : "An unexpected server error occurred." });
}
