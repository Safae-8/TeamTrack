const express = require("express");
const router = express.Router();

const pool = require("../db");

// ==========================================
// GET SETTINGS
// ==========================================

router.get("/", async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT
                team_name,
                academic_year,
                late_threshold,
                fine_per_late,
                monthly_absence_threshold,
                updated_at
            FROM team_settings
            WHERE id = 1`
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Team settings have not been initialized."
            });
        }

        res.json({
            success: true,
            settings: rows[0]
        });

    } catch (error) {
        console.error("Error loading settings:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load team settings."
        });
    }
});

// ==========================================
// UPDATE SETTINGS
// ==========================================

router.put("/", async (req, res) => {
    try {
        const {
            team_name,
            academic_year,
            late_threshold,
            fine_per_late,
            monthly_absence_threshold
        } = req.body;

        if (
            typeof team_name !== "string" ||
            !team_name.trim() ||
            team_name.trim().length > 150 ||
            typeof academic_year !== "string" ||
            !academic_year.trim() ||
            academic_year.trim().length > 20 ||
            !Number.isInteger(late_threshold) ||
            late_threshold < 1 ||
            typeof fine_per_late !== "number" ||
            !Number.isInteger(monthly_absence_threshold) ||
            monthly_absence_threshold < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide valid values for all settings."

            });
        }

        await pool.query(
            `UPDATE team_settings
            SET team_name = ?,
                academic_year = ?,
                late_threshold = ?,
                fine_per_late = ?,
                monthly_absence_threshold = ?
            WHERE id = 1`,
            [
                team_name.trim(),
                academic_year.trim(),
                late_threshold,
                fine_per_late,
                monthly_absence_threshold
            ]
        );

        const [rows] = await pool.query(
            `SELECT
                team_name,
                academic_year,
                late_threshold,
                fine_per_late,
                monthly_absence_threshold,
                update_at
            FROM team_settings
            WHERE id = 1`
        );

        res.json({
            success: true,
            message: "settings saved successfully.",
            settings: rows[0]
        });

    } catch (error) {
        console.error("Error saving settings:", error);

        res.status(500).json({
            success: false,
            message: "Failed to save team settings."
        });
    }
});

module.exports = router;