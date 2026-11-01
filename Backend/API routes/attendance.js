
const express = require("express");
const router = express.Router();
const db = require("../db");

/*
 * GET /api/attendance?month=YYYY-MM&training_session_id=1
 *
 * Returns attendance records joined with player and training details.
 * Both query parameters are optional.
 */
router.get("/", async (req, res) => {
    try {
        const { month, training_session_id } = req.query;

        if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
            return res.status(400).json({
                success: false,
                message: "Month must use YYYY-MM format."
            });
        }

        if (
            training_session_id &&
            !/^\d+$/.test(training_session_id)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid training session ID."
            });
        }

        const conditions = [];
        const params = [];

        if (month) {
            conditions.push(
                "ts.training_date >= ? AND ts.training_date < DATE_ADD(?, INTERVAL 1 MONTH)"
            );

            const monthStart = `${month}-01`;
            params.push(monthStart, monthStart);
        }

        if (training_session_id) {
            conditions.push("a.training_session_id = ?");
            params.push(Number(training_session_id));
        }

        const whereClause = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const [records] = await db.execute(
            `
            SELECT
                a.id,
                a.training_session_id,
                a.player_id,
                a.status,
                a.arrival_time,
                a.note,
                a.created_at,
                a.updated_at,
                p.full_name,
                p.jersey_name,
                p.jersey_number,
                p.position,
                ts.training_date,
                ts.start_time,
                ts.end_time,
                ts.location
            FROM attendance a
            INNER JOIN players p
                ON p.id = a.player_id
            INNER JOIN training_sessions ts
                ON ts.id = a.training_session_id
            ${whereClause}
            ORDER BY ts.training_date DESC, p.full_name ASC
            `,
            params
        );

        return res.json({
            success: true,
            count: records.length,
            attendance: records
        });

    } catch (error) {
        console.error("Error fetching attendance:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve attendance records."
        });
    }
});


/*
 * GET /api/attendance/session/:sessionId
 *
 * Returns all players and their attendance status for one session.
 * Players without an attendance record are returned with status = null.
 */
router.get("/session/:sessionId", async (req, res) => {
    try {
        const sessionId = Number(req.params.sessionId);

        if (!Number.isInteger(sessionId) || sessionId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid training session ID."
            });
        }

        const [sessions] = await db.execute(
            `
            SELECT id, training_date, start_time, end_time, location
            FROM training_sessions
            WHERE id = ?
            `,
            [sessionId]
        );

        if (sessions.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Training session not found."
            });
        }

        const [players] = await db.execute(
            `
            SELECT
                p.id AS player_id,
                p.full_name,
                p.jersey_name,
                p.jersey_number,
                p.position,
                a.id AS attendance_id,
                a.status,
                a.arrival_time,
                a.note
            FROM players p
            LEFT JOIN attendance a
                ON a.player_id = p.id
                AND a.training_session_id = ?
            ORDER BY p.full_name ASC
            `,
            [sessionId]
        );

        return res.json({
            success: true,
            session: sessions[0],
            players
        });

    } catch (error) {
        console.error("Error fetching session attendance:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve session attendance."
        });
    }
});


/*
 * POST /api/attendance
 *
 * Creates or updates one player's attendance for a training session.
 * The unique_session_player database index prevents duplicate records.
 */
router.post("/", async (req, res) => {
    try {
        const {
            training_session_id,
            player_id,
            status,
            arrival_time,
            note
        } = req.body;

        const sessionId = Number(training_session_id);
        const playerId = Number(player_id);

        const validStatuses = [
            "Present",
            "Late",
            "Absent",
            "Excused"
        ];

        if (
            !Number.isInteger(sessionId) ||
            sessionId <= 0 ||
            !Number.isInteger(playerId) ||
            playerId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid training session and player IDs are required."
            });
        }

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be Present, Late, Absent, or Excused."
            });
        }

        if (
            arrival_time &&
            !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(arrival_time)
        ) {
            return res.status(400).json({
                success: false,
                message: "Arrival time must use HH:MM or HH:MM:SS format."
            });
        }

        if (
            note !== undefined &&
            note !== null &&
            typeof note !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Note must be text."
            });
        }

        const [sessions] = await db.execute(
            "SELECT id FROM training_sessions WHERE id = ?",
            [sessionId]
        );

        if (sessions.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Training session not found."
            });
        }

        const [players] = await db.execute(
            "SELECT id FROM players WHERE id = ?",
            [playerId]
        );

        if (players.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Player not found."
            });
        }

        const normalizedArrivalTime =
            status === "Late" ? (arrival_time || null) : null;

        const normalizedNote =
            typeof note === "string" ? note.trim() || null : null;

        await db.execute(
            `
            INSERT INTO attendance (
                training_session_id,
                player_id,
                status,
                arrival_time,
                note
            )
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                status = VALUES(status),
                arrival_time = VALUES(arrival_time),
                note = VALUES(note),
                updated_at = CURRENT_TIMESTAMP
            `,
            [
                sessionId,
                playerId,
                status,
                normalizedArrivalTime,
                normalizedNote
            ]
        );

        return res.json({
            success: true,
            message: "Attendance saved successfully."
        });

    } catch (error) {
        console.error("Error saving attendance:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to save attendance."
        });
    }
});


module.exports = router;
