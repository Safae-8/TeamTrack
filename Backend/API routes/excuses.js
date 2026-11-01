const express = require("express");
const router = express.Router();
const db = require("../db");

const VALID_STATUSES = ["Pending", "Approved", "Rejected"];

/*
 * GET /api/excuses?month=YYYY-MM&status=Pending
 *
 * Get excuses with player and training-session details.
 */
router.get("/", async (req, res) => {
    try {
        const { month, status } = req.query;

        if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
            return res.status(400).json({
                success: false,
                message: "Month must use YYYY-MM format."
            });
        }

        if (status && status !== "All" && !VALID_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid excuse status."
            });
        }

        const conditions = [];
        const params = [];

        if (month) {
            const monthStart = `${month}-01`;

            conditions.push(`
                ts.training_date >= ?
                AND ts.training_date < DATE_ADD(?, INTERVAL 1 MONTH)
            `);

            params.push(monthStart, monthStart);
        }

        if (status && status !== "All") {
            conditions.push("e.status = ?");
            params.push(status);
        }

        const whereClause = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const [excuses] = await db.execute(
            `
            SELECT
                e.id,
                e.player_id,
                e.training_session_id,
                e.reason,
                e.explanation,
                e.evidence_path,
                e.status,
                e.reviewed_by,
                e.reviewed_at,
                e.created_at,
                p.full_name,
                p.jersey_name,
                ts.training_date,
                ts.start_time,
                ts.end_time,
                ts.location
            FROM excuses e
            INNER JOIN players p ON p.id = e.player_id
            INNER JOIN training_sessions ts
                ON ts.id = e.training_session_id
            ${whereClause}
            ORDER BY
                CASE WHEN e.status = 'Pending' THEN 0 ELSE 1 END,
                e.created_at DESC
            `,
            params
        );

        return res.json({
            success: true,
            count: excuses.length,
            excuses
        });

    } catch (error) {
        console.error("Error fetching excuses:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve excuse requests."
        });
    }
});


/*
 * POST /api/excuses
 *
 * Create a pending excuse request.
 * Reason and explanation may be empty when the reason is not yet known.
 */
router.post("/", async (req, res) => {
    try {
        const {
            player_id,
            training_session_id,
            reason,
            explanation,
            evidence_path
        } = req.body;

        const playerId = Number(player_id);
        const sessionId = Number(training_session_id);

        if (
            !Number.isInteger(playerId) ||
            playerId <= 0 ||
            !Number.isInteger(sessionId) ||
            sessionId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "A valid player and training session are required."
            });
        }

        if (
            reason !== undefined &&
            reason !== null &&
            typeof reason !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Reason must be text."
            });
        }

        if (
            explanation !== undefined &&
            explanation !== null &&
            typeof explanation !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Explanation must be text."
            });
        }

        if (
            evidence_path !== undefined &&
            evidence_path !== null &&
            typeof evidence_path !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Evidence path must be text."
            });
        }

        const cleanReason = (reason || "").trim();
        const cleanExplanation = (explanation || "").trim();
        const cleanEvidencePath = (evidence_path || "").trim();

        if (cleanReason.length > 255) {
            return res.status(400).json({
                success: false,
                message: "Reason cannot exceed 255 characters."
            });
        }

        if (cleanEvidencePath.length > 500) {
            return res.status(400).json({
                success: false,
                message: "Evidence path cannot exceed 500 characters."
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

        const [existing] = await db.execute(
            `
            SELECT id, status
            FROM excuses
            WHERE player_id = ?
              AND training_session_id = ?
            LIMIT 1
            `,
            [playerId, sessionId]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: "An excuse record already exists for this player and session. Edit the existing pending request instead.",
                existing_excuse_id: existing[0].id,
                existing_status: existing[0].status
            });
        }

        const [result] = await db.execute(
            `
            INSERT INTO excuses (
                player_id,
                training_session_id,
                reason,
                explanation,
                evidence_path,
                status
            )
            VALUES (?, ?, ?, ?, ?, 'Pending')
            `,
            [
                playerId,
                sessionId,
                cleanReason,
                cleanExplanation || null,
                cleanEvidencePath || null
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Excuse record created with Pending status.",
            id: result.insertId
        });

    } catch (error) {
        console.error("Error creating excuse:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create excuse record."
        });
    }
});


/*
 * PUT /api/excuses/:id
 *
 * Edit the details of a pending excuse.
 * Review status cannot be changed through this endpoint.
 */
router.put("/:id", async (req, res) => {
    try {
        const excuseId = Number(req.params.id);

        if (!Number.isInteger(excuseId) || excuseId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid excuse ID."
            });
        }

        const fields = [
            "reason",
            "explanation",
            "evidence_path"
        ];

        if (!fields.some(field =>
            Object.prototype.hasOwnProperty.call(req.body, field)
        )) {
            return res.status(400).json({
                success: false,
                message: "Provide at least one field to update."
            });
        }

        for (const field of fields) {
            if (
                Object.prototype.hasOwnProperty.call(req.body, field) &&
                req.body[field] !== null &&
                typeof req.body[field] !== "string"
            ) {
                return res.status(400).json({
                    success: false,
                    message: `${field} must be text or null.`
                });
            }
        }

        const [records] = await db.execute(
            "SELECT id, status FROM excuses WHERE id = ?",
            [excuseId]
        );

        if (records.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Excuse request not found."
            });
        }

        if (records[0].status !== "Pending") {
            return res.status(409).json({
                success: false,
                message: "Only pending excuses can be edited."
            });
        }

        const updates = [];
        const params = [];

        if (Object.prototype.hasOwnProperty.call(req.body, "reason")) {
            const reason = (req.body.reason || "").trim();

            if (reason.length > 255) {
                return res.status(400).json({
                    success: false,
                    message: "Reason cannot exceed 255 characters."
                });
            }

            updates.push("reason = ?");
            params.push(reason);
        }

        if (Object.prototype.hasOwnProperty.call(req.body, "explanation")) {
            const explanation = (req.body.explanation || "").trim();

            updates.push("explanation = ?");
            params.push(explanation || null);
        }

        if (Object.prototype.hasOwnProperty.call(req.body, "evidence_path")) {
            const evidencePath = (req.body.evidence_path || "").trim();

            if (evidencePath.length > 500) {
                return res.status(400).json({
                    success: false,
                    message: "Evidence path cannot exceed 500 characters."
                });
            }

            updates.push("evidence_path = ?");
            params.push(evidencePath || null);
        }

        params.push(excuseId);

        await db.execute(
            `UPDATE excuses SET ${updates.join(", ")} WHERE id = ?`,
            params
        );

        return res.json({
            success: true,
            message: "Pending excuse updated successfully.",
            id: excuseId
        });

    } catch (error) {
        console.error("Error updating excuse:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update excuse."
        });
    }
});


/*
 * PATCH /api/excuses/:id/status
 *
 * Approve or reject a pending excuse.
 */
router.patch("/:id/status", async (req, res) => {
    let connection;

    try {
        const excuseId = Number(req.params.id);
        const { status, reviewed_by } = req.body;

        if (!Number.isInteger(excuseId) || excuseId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid excuse ID."
            });
        }

        if (!["Approved", "Rejected"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be Approved or Rejected."
            });
        }

        if (
            reviewed_by !== undefined &&
            reviewed_by !== null &&
            typeof reviewed_by !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Reviewer name must be text."
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [records] = await connection.execute(
            "SELECT id, status FROM excuses WHERE id = ? FOR UPDATE",
            [excuseId]
        );

        if (records.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Excuse request not found."
            });
        }

        if (records[0].status !== "Pending") {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "This request has already been reviewed."
            });
        }

        const reviewer = typeof reviewed_by === "string"
            ? reviewed_by.trim().slice(0, 100) || null
            : null;

        await connection.execute(
            `
            UPDATE excuses
            SET status = ?, reviewed_by = ?, reviewed_at = NOW()
            WHERE id = ?
            `,
            [status, reviewer, excuseId]
        );

        await connection.commit();

        return res.json({
            success: true,
            message: `Excuse ${status.toLowerCase()} successfully.`,
            id: excuseId,
            status
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Error reviewing excuse:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update excuse status."
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});
/*
 * DELETE /api/excuses/:id
 *
 * Delete an excuse request.
 * Only pending excuses can be deleted.
 */
router.delete("/:id", async (req, res) => {
    try {
        const excuseId = Number(req.params.id);

        if (!Number.isInteger(excuseId) || excuseId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid excuse ID."
            });
        }

        const [records] = await db.execute(
            "SELECT id, status FROM excuses WHERE id = ?",
            [excuseId]
        );

        if (records.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Excuse request not found."
            });
        }

        if (records[0].status !== "Pending") {
            return res.status(409).json({
                success: false,
                message: "Only pending excuses can be deleted."
            });
        }

        await db.execute(
            "DELETE FROM excuses WHERE id = ?",
            [excuseId]
        );

        return res.json({
            success: true,
            message: "Excuse deleted successfully.",
            id: excuseId
        });

    } catch (error) {
        console.error("Error deleting excuse:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete excuse."
        });
    }
});

module.exports = router;