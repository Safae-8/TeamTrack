
const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET all training sessions
// Optional: ?month=2026-10
router.get("/", async (req, res) => {
    try {
        const { month } = req.query;

        let sql = `
            SELECT
                id,
                training_date,
                start_time,
                end_time,
                location,
                notes,
                created_at
            FROM training_sessions
        `;

        const params = [];

        if (month) {
            if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
                return res.status(400).json({
                    success: false,
                    message: "Month must use YYYY-MM format."
                });
            }

            sql += " WHERE training_date >= ? AND training_date < ?";
            params.push(
                `${month}-01`,
                nextMonth(month)
            );
        }

        sql += " ORDER BY training_date DESC, start_time DESC";

        const [sessions] = await pool.query(sql, params);

        res.json({
            success: true,
            count: sessions.length,
            sessions
        });
    } catch (error) {
        console.error("Error loading training sessions:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load training sessions."
        });
    }
});

// GET one training session
router.get("/:id", async (req, res) => {
    try {
        const sessionId = Number(req.params.id);

        if (!Number.isInteger(sessionId) || sessionId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid training session ID."
            });
        }

        const [sessions] = await pool.query(
            `SELECT id, training_date, start_time, end_time,
                    location, notes, created_at
             FROM training_sessions
             WHERE id = ?`,
            [sessionId]
        );

        if (sessions.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Training session not found."
            });
        }

        res.json({
            success: true,
            session: sessions[0]
        });
    } catch (error) {
        console.error("Error loading training session:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load training session."
        });
    }
});

// CREATE a training session
router.post("/", async (req, res) => {
    try {
        const {
            training_date,
            start_time,
            end_time,
            location,
            notes
        } = req.body;

        if (
            typeof training_date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(training_date) ||
            !isValidDate(training_date)
        ) {
            return res.status(400).json({
                success: false,
                message: "A valid training date is required (YYYY-MM-DD)."
            });
        }

        if (start_time && !isValidTime(start_time)) {
            return res.status(400).json({
                success: false,
                message: "Start time must use HH:MM or HH:MM:SS format."
            });
        }

        if (end_time && !isValidTime(end_time)) {
            return res.status(400).json({
                success: false,
                message: "End time must use HH:MM or HH:MM:SS format."
            });
        }

        if (start_time && end_time && end_time <= start_time) {
            return res.status(400).json({
                success: false,
                message: "End time must be later than start time."
            });
        }

        const [result] = await pool.query(
            `INSERT INTO training_sessions
                (training_date, start_time, end_time, location, notes)
             VALUES (?, ?, ?, ?, ?)`,
            [
                training_date,
                start_time || null,
                end_time || null,
                cleanText(location),
                cleanText(notes)
            ]
        );

        const [sessions] = await pool.query(
            `SELECT id, training_date, start_time, end_time,
                    location, notes, created_at
             FROM training_sessions
             WHERE id = ?`,
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            message: "Training session created successfully.",
            session: sessions[0]
        });
    } catch (error) {
        console.error("Error creating training session:", error);

        res.status(500).json({
            success: false,
            message: "Failed to create training session."
        });
    }
});

// UPDATE a training session
router.put("/:id", async (req, res) => {
    try {
        const sessionId = Number(req.params.id);

        if (!Number.isInteger(sessionId) || sessionId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid training session ID."
            });
        }

        const {
            training_date,
            start_time,
            end_time,
            location,
            notes
        } = req.body;

        if (
            typeof training_date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(training_date) ||
            !isValidDate(training_date)
        ) {
            return res.status(400).json({
                success: false,
                message: "A valid training date is required (YYYY-MM-DD)."
            });
        }

        if (start_time && !isValidTime(start_time)) {
            return res.status(400).json({
                success: false,
                message: "Invalid start time."
            });
        }

        if (end_time && !isValidTime(end_time)) {
            return res.status(400).json({
                success: false,
                message: "Invalid end time."
            });
        }

        if (start_time && end_time && end_time <= start_time) {
            return res.status(400).json({
                success: false,
                message: "End time must be later than start time."
            });
        }

        const [result] = await pool.query(
            `UPDATE training_sessions
             SET training_date = ?,
                 start_time = ?,
                 end_time = ?,
                 location = ?,
                 notes = ?
             WHERE id = ?`,
            [
                training_date,
                start_time || null,
                end_time || null,
                cleanText(location),
                cleanText(notes),
                sessionId
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Training session not found."
            });
        }

        const [sessions] = await pool.query(
            `SELECT id, training_date, start_time, end_time,
                    location, notes, created_at
             FROM training_sessions
             WHERE id = ?`,
            [sessionId]
        );

        res.json({
            success: true,
            message: "Training session updated successfully.",
            session: sessions[0]
        });
    } catch (error) {
        console.error("Error updating training session:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update training session."
        });
    }
});

// DELETE a training session
router.delete("/:id", async (req, res) => {
    try {
        const sessionId = Number(req.params.id);

        if (!Number.isInteger(sessionId) || sessionId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid training session ID."
            });
        }

        // Do not silently delete a session that already has attendance.
        const [attendance] = await pool.query(
            `SELECT id
             FROM attendance
             WHERE training_session_id = ?
             LIMIT 1`,
            [sessionId]
        );

        if (attendance.length > 0) {
            return res.status(409).json({
                success: false,
                message: "This session has attendance records and cannot be deleted."
            });
        }

        const [result] = await pool.query(
            "DELETE FROM training_sessions WHERE id = ?",
            [sessionId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Training session not found."
            });
        }

        res.json({
            success: true,
            message: "Training session deleted successfully."
        });
    } catch (error) {
        console.error("Error deleting training session:", error);

        res.status(500).json({
            success: false,
            message: "Failed to delete training session."
        });
    }
});

function nextMonth(month) {
    const [year, monthNumber] = month.split("-").map(Number);
    const date = new Date(Date.UTC(year, monthNumber, 1));

    return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, "0"),
        "01"
    ].join("-").replace(/-(\d{2})-01$/, "-$1-01");
}

function isValidDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
}

function isValidTime(value) {
    return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);
}

function cleanText(value) {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed || null;
}

module.exports = router;