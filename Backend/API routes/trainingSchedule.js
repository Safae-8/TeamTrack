
const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET all schedule rules
router.get("/", async (req, res) => {
    try {
        const [rules] = await pool.query(`
            SELECT
                id,
                day_of_week,
                start_time,
                end_time,
                location,
                effective_from,
                effective_until,
                is_active,
                notes,
                created_at,
                updated_at
            FROM training_schedule_rules
            ORDER BY day_of_week, effective_from
        `);

        res.json({
            success: true,
            count: rules.length,
            rules
        });
    } catch (error) {
        console.error("Error loading schedule rules:", error);
        res.status(500).json({
            success: false,
            message: "Failed to load schedule rules."
        });
    }
});

// CREATE a schedule rule
router.post("/", async (req, res) => {
    try {
        const {
            day_of_week,
            start_time,
            end_time,
            location,
            effective_from,
            effective_until,
            notes
        } = req.body;

        const day = Number(day_of_week);

        if (!Number.isInteger(day) || day < 0 || day > 6) {
            return res.status(400).json({
                success: false,
                message: "Day must be between 0 (Sunday) and 6 (Saturday)."
            });
        }

        if (
            typeof start_time !== "string" ||
            !isValidTime(start_time) ||
            typeof end_time !== "string" ||
            !isValidTime(end_time) ||
            end_time <= start_time
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter valid times, with the end later than the start."
            });
        }

        if (!isValidDate(effective_from)) {
            return res.status(400).json({
                success: false,
                message: "A valid effective-from date (YYYY-MM-DD) is required."
            });
        }

        if (
            effective_until &&
            (!isValidDate(effective_until) ||
                effective_until < effective_from)
        ) {
            return res.status(400).json({
                success: false,
                message: "The end date must be valid and not before the start date."
            });
        }

        if (
            typeof location !== "string" ||
            !location.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Location is required."
            });
        }

        const [result] = await pool.query(
            `INSERT INTO training_schedule_rules
                (day_of_week, start_time, end_time, location,
                 effective_from, effective_until, is_active, notes)
             VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
            [
                day,
                start_time,
                end_time,
                location.trim(),
                effective_from,
                effective_until || null,
                cleanText(notes)
            ]
        );

        const [rules] = await pool.query(
            "SELECT * FROM training_schedule_rules WHERE id = ?",
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            message: "Schedule rule created successfully.",
            rule: rules[0]
        });
    } catch (error) {
        console.error("Error creating schedule rule:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create schedule rule."
        });
    }
});

// UPDATE a schedule rule
router.put("/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid schedule rule ID."
            });
        }

        const {
            day_of_week,
            start_time,
            end_time,
            location,
            effective_from,
            effective_until,
            is_active,
            notes
        } = req.body;

        const day = Number(day_of_week);
        const active = Number(is_active);

        if (!Number.isInteger(day) || day < 0 || day > 6) {
            return res.status(400).json({
                success: false,
                message: "Invalid day of week."
            });
        }

        if (
            typeof start_time !== "string" ||
            !isValidTime(start_time) ||
            typeof end_time !== "string" ||
            !isValidTime(end_time) ||
            end_time <= start_time
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter valid times, with the end later than the start."
            });
        }

        if (!isValidDate(effective_from)) {
            return res.status(400).json({
                success: false,
                message: "A valid effective-from date is required."
            });
        }

        if (
            effective_until &&
            (!isValidDate(effective_until) ||
                effective_until < effective_from)
        ) {
            return res.status(400).json({
                success: false,
                message: "The end date must not be before the start date."
            });
        }

        if (active !== 0 && active !== 1) {
            return res.status(400).json({
                success: false,
                message: "is_active must be 0 or 1."
            });
        }

        if (typeof location !== "string" || !location.trim()) {
            return res.status(400).json({
                success: false,
                message: "Location is required."
            });
        }

        const [result] = await pool.query(
            `UPDATE training_schedule_rules
             SET day_of_week = ?,
                 start_time = ?,
                 end_time = ?,
                 location = ?,
                 effective_from = ?,
                 effective_until = ?,
                 is_active = ?,
                 notes = ?
             WHERE id = ?`,
            [
                day,
                start_time,
                end_time,
                location.trim(),
                effective_from,
                effective_until || null,
                active,
                cleanText(notes),
                id
            ]
        );

        if (result.affectedRows === 0) {
            const [existing] = await pool.query(
                "SELECT id FROM training_schedule_rules WHERE id = ?",
                [id]
            );

            if (existing.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Schedule rule not found."
                });
            }
        }

        const [rules] = await pool.query(
            "SELECT * FROM training_schedule_rules WHERE id = ?",
            [id]
        );

        res.json({
            success: true,
            message: "Schedule rule updated successfully.",
            rule: rules[0]
        });
    } catch (error) {
        console.error("Error updating schedule rule:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update schedule rule."
        });
    }
});

// DELETE a rule only if it has not been used to generate sessions.
// For semester changes, prefer setting effective_until or is_active = 0.
router.delete("/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid schedule rule ID."
            });
        }

        const [rules] = await pool.query(
            "SELECT id FROM training_schedule_rules WHERE id = ?",
            [id]
        );

        if (rules.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Schedule rule not found."
            });
        }

        await pool.query(
            "DELETE FROM training_schedule_rules WHERE id = ?",
            [id]
        );

        res.json({
            success: true,
            message: "Schedule rule deleted."
        });
    } catch (error) {
        console.error("Error deleting schedule rule:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete schedule rule."
        });
    }
});

function isValidDate(value) {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return false;
    }

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

/**
 * Generate training sessions for a month using active schedule rules.
 * Existing matching sessions are skipped, never overwritten or deleted.
 */
router.post("/generate-month", async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const { month } = req.body;

        if (
            typeof month !== "string" ||
            !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
        ) {
            return res.status(400).json({
                success: false,
                message: "Month must use YYYY-MM format."
            });
        }

        const [year, monthNumber] = month.split("-").map(Number);

        const firstDate = `${month}-01`;
        const nextMonthDate = new Date(
            Date.UTC(year, monthNumber, 1)
        );

        const endDate = [
            nextMonthDate.getUTCFullYear(),
            String(nextMonthDate.getUTCMonth() + 1).padStart(2, "0"),
            "01"
        ].join("-");

        const daysInMonth = new Date(
            Date.UTC(year, monthNumber, 0)
        ).getUTCDate();

        const [rules] = await connection.query(
            `SELECT id, day_of_week, start_time, end_time,
                    location, effective_from, effective_until, notes
             FROM training_schedule_rules
             WHERE is_active = 1
               AND effective_from < ?
               AND (effective_until IS NULL OR effective_until >= ?)
             ORDER BY id`,
            [endDate, firstDate]
        );

        let created = 0;
        let skipped = 0;

        await connection.beginTransaction();

        for (let day = 1; day <= daysInMonth; day++) {
            const date = [
                year,
                String(monthNumber).padStart(2, "0"),
                String(day).padStart(2, "0")
            ].join("-");

            const weekday = new Date(
                Date.UTC(year, monthNumber - 1, day)
            ).getUTCDay();

            for (const rule of rules) {
                if (Number(rule.day_of_week) !== weekday) {
                    continue;
                }

                // Compare ISO date strings without local timezone conversion.
                const effectiveFrom = toSqlDate(rule.effective_from);
                const effectiveUntil = rule.effective_until
                    ? toSqlDate(rule.effective_until)
                    : null;

                if (
                    date < effectiveFrom ||
                    (effectiveUntil && date > effectiveUntil)
                ) {
                    continue;
                }

                const startTime = String(rule.start_time).slice(0, 8);
                const endTime = String(rule.end_time).slice(0, 8);

                const [existing] = await connection.query(
                    `SELECT id
                     FROM training_sessions
                     WHERE training_date = ?
                       AND start_time = ?
                       AND end_time = ?
                       AND location = ?
                     LIMIT 1`,
                    [date, startTime, endTime, rule.location]
                );

                if (existing.length > 0) {
                    skipped++;
                    continue;
                }

                await connection.query(
                    `INSERT INTO training_sessions
                        (training_date, start_time, end_time, location, notes)
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        date,
                        startTime,
                        endTime,
                        rule.location,
                        rule.notes || "Regular weekly team training"
                    ]
                );

                created++;
            }
        }

        await connection.commit();

        res.json({
            success: true,
            message: `Session generation completed for ${month}.`,
            month,
            rules_used: rules.length,
            created,
            skipped
        });
    } catch (error) {
        await connection.rollback();

        console.error("Error generating monthly sessions:", error);

        res.status(500).json({
            success: false,
            message: "Failed to generate monthly sessions."
        });
    } finally {
        connection.release();
    }
});


function toSqlDate(value) {
    if (typeof value === "string") {
        return value.slice(0, 10);
    }

    if (value instanceof Date) {
        // Use local date fields to preserve MySQL DATE values
        // when the driver has parsed them as JavaScript Dates.
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, "0");
        const day = String(value.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    throw new Error("Unexpected SQL date format.");
}

module.exports = router;