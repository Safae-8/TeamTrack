const express = require("express");
const router = express.Router();

const pool = require("../db");


// ==========================================
// GET ALL PLAYERS
// ==========================================

router.get("/", async (req, res) => {
    try {
        const [players] = await pool.query(`
            SELECT
                id,
                full_name,
                jersey_name,
                student_id,
                phone,
                position,
                jersey_number,
                join_date,
                status,
                created_at,
                updated_at
            FROM players
            ORDER BY full_name ASC
        `);

        res.json({
            success: true,
            players: players
        });

    } catch (error) {
        console.error("Error fetching players:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch players.",
            error: error.message
        });
    }
});


// ==========================================
// GET ONE PLAYER
// ==========================================

router.get("/:id", async (req, res) => {
    try {
        const playerId = Number(req.params.id);

        if (!Number.isInteger(playerId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid player ID."
            });
        }

        const [players] = await pool.query(
            `
            SELECT
                id,
                full_name,
                jersey_name,
                student_id,
                phone,
                position,
                jersey_number,
                join_date,
                status,
                created_at,
                updated_at
            FROM players
            WHERE id = ?
            `,
            [playerId]
        );

        if (players.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Player not found."
            });
        }

        res.json({
            success: true,
            player: players[0]
        });

    } catch (error) {
        console.error("Error fetching player:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch player.",
            error: error.message
        });
    }
});


// ==========================================
// ADD NEW PLAYER
// ==========================================

router.post("/", async (req, res) => {
    try {
        const {
            full_name,
            jersey_name,
            student_id,
            phone,
            position,
            jersey_number,
            join_date
        } = req.body;


        // ------------------------------
        // Validate required fields
        // ------------------------------

        if (!full_name || !full_name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Full name is required."
            });
        }

        if (!join_date) {
            return res.status(400).json({
                success: false,
                message: "Join date is required."
            });
        }


        // ------------------------------
        // Insert player
        // ------------------------------

        const [result] = await pool.query(
            `
            INSERT INTO players
            (
                full_name,
                jersey_name,
                student_id,
                phone,
                position,
                jersey_number,
                join_date
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
                full_name.trim(),
                jersey_name || null,
                student_id || null,
                phone || null,
                position || null,
                jersey_number || null,
                join_date
            ]
        );


        // ------------------------------
        // Return created player
        // ------------------------------

        const [players] = await pool.query(
            `
            SELECT
                id,
                full_name,
                jersey_name,
                student_id,
                phone,
                position,
                jersey_number,
                join_date,
                status,
                created_at,
                updated_at
            FROM players
            WHERE id = ?
            `,
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            message: "Player added successfully.",
            player: players[0]
        });

    } catch (error) {
        console.error("Error adding player:", error);

        res.status(500).json({
            success: false,
            message: "Failed to add player.",
            error: error.message
        });
    }
});


// ==========================================
// UPDATE PLAYER
// ==========================================

router.put("/:id", async (req, res) => {

    try {

        const playerId = Number(req.params.id);

        if (!Number.isInteger(playerId)) {

            return res.status(400).json({
                success: false,
                message: "Invalid player ID."
            });

        }


        const {
            full_name,
            jersey_name,
            student_id,
            phone,
            position,
            jersey_number,
            join_date,
            status
        } = req.body;


        // ----------------------------------
        // VALIDATION
        // ----------------------------------

        if (!full_name || !full_name.trim()) {

            return res.status(400).json({
                success: false,
                message: "Full name is required."
            });

        }


        if (!join_date) {

            return res.status(400).json({
                success: false,
                message: "Join date is required."
            });

        }


        // ----------------------------------
        // UPDATE PLAYER
        // ----------------------------------

        const [result] = await pool.query(
            `
            UPDATE players
            SET
                full_name = ?,
                jersey_name = ?,
                student_id = ?,
                phone = ?,
                position = ?,
                jersey_number = ?,
                join_date = ?,
                status = ?
            WHERE id = ?
            `,
            [
                full_name.trim(),
                jersey_name || null,
                student_id || null,
                phone || null,
                position || null,
                jersey_number || null,
                join_date,
                status === "Inactive"
                    ? "Inactive"
                    : "Active",
                playerId
            ]
        );


        // ----------------------------------
        // PLAYER NOT FOUND
        // ----------------------------------

        if (result.affectedRows === 0) {

            return res.status(404).json({
                success: false,
                message: "Player not found."
            });

        }


        // ----------------------------------
        // GET UPDATED PLAYER
        // ----------------------------------

        const [players] = await pool.query(
            `
            SELECT
                id,
                full_name,
                jersey_name,
                student_id,
                phone,
                position,
                jersey_number,
                join_date,
                status,
                created_at,
                updated_at
            FROM players
            WHERE id = ?
            `,
            [playerId]
        );


        // ----------------------------------
        // SUCCESS
        // ----------------------------------

        res.json({
            success: true,
            message: "Player updated successfully.",
            player: players[0]
        });


    } catch (error) {

        console.error(
            "Error updating player:",
            error
        );


        res.status(500).json({
            success: false,
            message: "Failed to update player.",
            error: error.message
        });

    }

});


// ==========================================
// DEACTIVATE PLAYER
// ==========================================

router.patch("/:id/deactivate", async (req, res) => {
    try {
        const playerId = Number(req.params.id);

        if (!Number.isInteger(playerId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid player ID."
            });
        }

        const [result] = await pool.query(
            `
            UPDATE players
            SET status = 'Inactive'
            WHERE id = ?
            `,
            [playerId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Player not found."
            });
        }

        res.json({
            success: true,
            message: "Player deactivated successfully."
        });

    } catch (error) {
        console.error("Error deactivating player:", error);

        res.status(500).json({
            success: false,
            message: "Failed to deactivate player.",
            error: error.message
        });
    }
});


module.exports = router;