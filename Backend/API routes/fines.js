
const express = require("express");
const router = express.Router();
const db = require("../db");



/*
 * GET /api/fines?month=YYYY-MM
 * Retrieve fines for a selected month.
 */
router.get("/", async (req, res) => {
    try {
        const { month } = req.query;

        if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
            return res.status(400).json({
                success: false,
                message: "Month must use YYYY-MM format."
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

        const whereClause = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const [fines] = await db.execute(
            `
            SELECT
                f.id,
                f.player_id,
                f.attendance_id,
                f.amount,
                f.reason,
                f.payment_status,
                f.paid_at,
                f.created_at,
                p.full_name,
                p.jersey_name,
                p.jersey_number,
                ts.training_date
            FROM fines f
            INNER JOIN players p
                ON p.id = f.player_id
            INNER JOIN attendance a
                ON a.id = f.attendance_id
            INNER JOIN training_sessions ts
                ON ts.id = a.training_session_id
            ${whereClause}
            ORDER BY ts.training_date DESC, p.full_name ASC
            `,
            params
        );

        return res.json({
            success: true,
            count: fines.length,
            fines
        });

    } catch (error) {
        console.error("Error fetching fines:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve fines."
        });
    }
});



/*
 * POST /api/fines/generate
 * Create a fine for each late attendance record
 * that does not already have a fine.
 * New fines use the current fine_per_late setting.
 * Existing fines and their payment statuses are preserved.
 */
router.post("/generate", async (req, res) => {
    try {
        const { month } = req.body;

        if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
            return res.status(400).json({
                success: false,
                message: "Month must use YYYY-MM format."
            });
        }

        const [settings] = await db.execute(
            "SELECT fine_per_late FROM team_settings WHERE id = 1"
        );

        if (settings.length === 0) {
            return res.status(500).json({
                success: false,
                message: "Team attendance settings have not been initialized."
            });
        }

        const fineAmount = Number(settings[0].fine_per_late);

        if (!Number.isFinite(fineAmount) || fineAmount < 0) {
            return res.status(500).json({
                success: false,
                message: "The configured fine amount is invalid."
            });
        }

        const conditions = ["a.status = 'Late'"];
        const params = [];

        if (month) {
            conditions.push(
                "ts.training_date >= ? AND ts.training_date < DATE_ADD(?, INTERVAL 1 MONTH)"
            );

            const monthStart = `${month}-01`;
            params.push(monthStart, monthStart);
        }

        const [result] = await db.execute(
            `
            INSERT INTO fines (
                player_id,
                attendance_id,
                amount,
                reason,
                payment_status
            )
            SELECT
                a.player_id,
                a.id,
                ?,
                'Late arrival',
                'Unpaid'
            FROM attendance a
            INNER JOIN training_sessions ts
                ON ts.id = a.training_session_id
            WHERE ${conditions.join(" AND ")}
            ON DUPLICATE KEY UPDATE
                attendance_id = VALUES(attendance_id)
            `,
            [fineAmount, ...params]
        );

        return res.json({
            success: true,
            message: "Fine generation completed.",
            fineAmount,
            affectedRows: result.affectedRows
        });

    } catch (error) {
        console.error("Error generating fines:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to generate fines."
        });
    }
});



/*
 * PATCH /api/fines/:id/payment
 * Mark one fine as Paid or Unpaid.
 */
router.patch("/:id/payment", async (req, res) => {
    try {
        const fineId = Number(req.params.id);
        const { payment_status } = req.body;

        if (!Number.isInteger(fineId) || fineId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid fine ID."
            });
        }

        if (!["Paid", "Unpaid"].includes(payment_status)) {
            return res.status(400).json({
                success: false,
                message: "Payment status must be Paid or Unpaid."
            });
        }

        const [result] = await db.execute(
            `
            UPDATE fines
            SET
                payment_status = ?,
                paid_at = CASE
                    WHEN ? = 'Paid' THEN COALESCE(paid_at, NOW())
                    ELSE NULL
                END
            WHERE id = ?
            `,
            [payment_status, payment_status, fineId]
        );

        if (result.affectedRows === 0) {
            const [existing] = await db.execute(
                "SELECT id FROM fines WHERE id = ?",
                [fineId]
            );

            if (existing.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Fine not found."
                });
            }
        }

        return res.json({
            success: true,
            message: `Fine marked as ${payment_status}.`
        });

    } catch (error) {
        console.error("Error updating fine payment:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update payment status."
        });
    }
});


module.exports = router;
