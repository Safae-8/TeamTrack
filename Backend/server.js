const express = require("express");
const cors = require("cors");
const path = require("path");

const pool = require("./db");
const playersRouter = require("./API routes/players");
const trainingSessionsRouter = require("./API routes/trainingSessions");
const trainingScheduleRouter = require("./API routes/trainingSchedule");
const attendanceRouter = require("./API routes/attendance");
const excusesRouter = require("./API routes/excuses");
const finesRouter = require("./API routes/fines");
const settingsRouter = require("./API routes/settings");
const app = express();
const PORT = Number(process.env.PORT) || 3000;
require("dotenv").config();
app.use(cors());
app.use(express.json());

app.use("/api/players", playersRouter);
app.use("/api/training-sessions", trainingSessionsRouter);
app.use("/api/training-schedule", trainingScheduleRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/excuses", excusesRouter);
app.use("/api/fines", finesRouter);
app.use("/api/settings", settingsRouter);

const frontendPath = path.join(__dirname, "..", "Frontend");

app.use(express.static(frontendPath));


// ==========================================
// DATABASE TEST
// ==========================================

app.get("/api/db-test", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT 1 AS result");

        res.json({
            success: true,
            message: "Database connection is working.",
            result: rows[0]
        });

    } catch (error) {
        console.error("Database error:", error);

        res.status(500).json({
            success: false,
            message: "Database connection failed.",
            error: error.message
        });
    }
});


// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "TeamTrack backend is running.",
        timestamp: new Date().toISOString()
    });
});


// ==========================================
// DASHBOARD TEST
// ==========================================

app.get("/api/dashboard", (req, res) => {
    res.json({
        success: true,
        message: "TeamTrack dashboard API is working."
    });
});


// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
    console.log("==========================================");
    console.log("       TeamTrack Backend Started");
    console.log("==========================================");
    console.log(`Server: http://localhost:${PORT}`);
    console.log(`API:    http://localhost:${PORT}/api/health`);
    console.log(`DB:     http://localhost:${PORT}/api/db-test`);
    console.log("==========================================");
});