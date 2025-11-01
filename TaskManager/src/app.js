import express from "express";

const app =express();

//router imports
import healthcheckRoutes from "./routes/healthcheck.routes.js";
import authRoutes from "./routes/auth.routes.js";
import noteRoutes from "./routes/note.routes.js";
import projectRoutes from "./routes/project.routes.js";
import taskRoutes from "./routes/task.routes.js";

//router middleware

app.use("/api/v1/healthcheck", healthcheckRoutes);


export default app;