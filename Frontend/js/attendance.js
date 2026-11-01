const API_BASE_URL = "http://localhost:3000/api";

document.addEventListener("DOMContentLoaded", () => {
    const sessionSelect = document.getElementById("attendanceSessionSelect");
    const sessionInfo = document.getElementById("attendanceSessionInfo");
    const playersBody = document.getElementById("attendancePlayersBody");
    const saveButton = document.getElementById("saveAttendanceButton");
    const resetButton = document.getElementById("resetAttendanceButton");
    const message = document.getElementById("attendanceMessage");
    const excusePanel = document.getElementById("attendanceExcusePanel");
    const excuseForm = document.getElementById("attendanceExcuseForm");
    const excuseSelectedPlayer = document.getElementById("excuseSelectedPlayer");
    const excuseOutcome = document.getElementById("excuseAttendanceOutcome");
    const excuseCategory = document.getElementById("excuseCategory");
    const excuseOtherGroup = document.getElementById("excuseOtherGroup");
    const excuseOtherCategory = document.getElementById("excuseOtherCategory");
    const excuseExplanation = document.getElementById("excuseExplanation");
    const excuseEvidence = document.getElementById("excuseEvidence");
    const excuseMessage = document.getElementById("attendanceExcuseMessage");
    const cancelExcuseButton = document.getElementById("cancelAttendanceExcuse");
    const saveExcuseButton = document.getElementById("saveAttendanceExcuse");

    let selectedExcuseRow = null;
    let isSavingExcuse = false;

    const totalPlayersElement = document.getElementById("attendanceTotalPlayers");
    const presentElement = document.getElementById("attendancePresentCount");
    const lateElement = document.getElementById("attendanceLateCount");
    const absentElement = document.getElementById("attendanceAbsentCount");

    let currentPlayers = [];
    let isSaving = false;

    function getCurrentMonth() {
        if (typeof getSelectedTeamTrackMonth === "function") {
            return getSelectedTeamTrackMonth();
        }

        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, (character) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function formatDate(value) {
        if (!value) return "Date unavailable";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Date unavailable";
        }

        return date.toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }

    function formatTime(value) {
        if (!value) return "";

        const match = String(value).match(/^(\d{1,2}):(\d{2})/);

        if (!match) return String(value);

        const hours = Number(match[1]);
        const minutes = match[2];

        return `${String(hours).padStart(2, "0")}:${minutes}`;
    }

    function showMessage(text, type = "") {
        message.textContent = text;
        message.className = type;
    }

    function updateStatistics() {
        totalPlayersElement.textContent = currentPlayers.length;

        presentElement.textContent = currentPlayers.filter(
            player => player.status === "Present"
        ).length;

        lateElement.textContent = currentPlayers.filter(
            player => player.status === "Late"
        ).length;

        absentElement.textContent = currentPlayers.filter(
            player => player.status === "Absent"
        ).length;
    }

    function updateArrivalTimeInput(row) {
        const statusSelect = row.querySelector(".attendance-status");
        const arrivalInput = row.querySelector(".attendance-arrival");

        if (!statusSelect || !arrivalInput) return;

        const isLate = statusSelect.value === "Late";

        arrivalInput.disabled = !isLate;

        if (!isLate) {
            arrivalInput.value = "";
        }
    }

    function renderPlayers() {
        if (!currentPlayers.length) {
            playersBody.innerHTML = `
                <tr>
                    <td colspan="6" class="table-loading">
                        No players were found.
                    </td>
                </tr>
            `;

            saveButton.disabled = true;
            updateStatistics();
            return;
        }

        playersBody.innerHTML = currentPlayers.map((player, index) => {
            const playerName = player.full_name || "Unnamed player";
            const position = player.position || "Not specified";
            const status = player.status || "";
            const arrivalTime = player.arrival_time
                ? formatTime(player.arrival_time)
                : "";
            const note = player.note || "";

            return `
                <tr data-player-id="${Number(player.player_id)}">
                    <td>${index + 1}</td>

                    <td>
                        <div class="attendance-player-name">
                            ${escapeHTML(playerName)}
                        </div>
                        ${
                            player.jersey_number !== null &&
                            player.jersey_number !== undefined
                                ? `<small>#${escapeHTML(player.jersey_number)}</small>`
                                : ""
                        }
                    </td>

                    <td>${escapeHTML(position)}</td>

                    <td>
                        <select
                            class="attendance-status"
                            aria-label="Attendance status for ${escapeHTML(playerName)}"
                        >
                            <option value="" ${status === "" ? "selected" : ""}>
                                Not recorded
                            </option>
                            <option value="Present" ${status === "Present" ? "selected" : ""}>
                                Present
                            </option>
                            <option value="Late" ${status === "Late" ? "selected" : ""}>
                                Late
                            </option>
                            <option value="Absent" ${status === "Absent" ? "selected" : ""}>
                                Absent
                            </option>
                            <option value="Excused" ${status === "Excused" ? "selected" : ""}>
                                Excused
                            </option>
                        </select>
                    </td>

                    <td>
                        <input
                            type="time"
                            class="attendance-arrival"
                            aria-label="Arrival time for ${escapeHTML(playerName)}"
                            value="${escapeHTML(arrivalTime)}"
                            ${status !== "Late" ? "disabled" : ""}
                        >
                    </td>

                    <td>
                        <input
                            type="text"
                            class="attendance-note"
                            aria-label="Attendance note for ${escapeHTML(playerName)}"
                            value="${escapeHTML(note)}"
                            maxlength="1000"
                            placeholder="Optional note"
                        >
                    </td>
                </tr>
            `;
        }).join("");

        saveButton.disabled = false;
        updateStatistics();
    }

    async function loadSessions(preferredSessionId = null) {
        sessionSelect.disabled = true;
        saveButton.disabled = true;

        sessionSelect.innerHTML = `
            <option value="">Loading training sessions...</option>
        `;

        sessionInfo.textContent = "Loading training session details...";
        playersBody.innerHTML = `
            <tr>
                <td colspan="6" class="table-loading">
                    Loading training sessions...
                </td>
            </tr>
        `;

        currentPlayers = [];
        updateStatistics();
        showMessage("");

        try {
            const month = getCurrentMonth();

            const response = await fetch(
                `${API_BASE_URL}/training-sessions?month=${encodeURIComponent(month)}`
            );

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(data.message || "Could not load training sessions.");
            }

            const sessions = Array.isArray(data)
                ? data
                : data.sessions || data.trainingSessions || [];

            if (!sessions.length) {
                sessionSelect.innerHTML = `
                    <option value="">No sessions for ${escapeHTML(month)}</option>
                `;

                sessionInfo.textContent =
                    "No training sessions were found for this month. Open Training Sessions to schedule or generate sessions.";

                playersBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="table-loading">
                            No training sessions available for this month.
                        </td>
                    </tr>
                `;

                sessionSelect.disabled = true;
                saveButton.disabled = true;
                return;
            }

            sessionSelect.innerHTML = `
                <option value="">Choose a training session</option>
                ${sessions.map(session => {
                    const date = formatDate(session.training_date);
                    const start = formatTime(session.start_time);
                    const end = formatTime(session.end_time);
                    const time = start
                        ? `${start}${end ? `–${end}` : ""}`
                        : "";
                    const location = session.location || "Location not set";

                    return `
                        <option value="${Number(session.id)}">
                            ${escapeHTML(date)}${time ? ` · ${escapeHTML(time)}` : ""}
                        </option>
                    `;
                }).join("")}
            `;

            sessionSelect.disabled = false;

            const preferredExists = preferredSessionId &&
                sessions.some(session => String(session.id) === String(preferredSessionId));

            if (preferredExists) {
                sessionSelect.value = String(preferredSessionId);
            } else {
                // Prefer the first session returned by the API.
                sessionSelect.value = String(sessions[0].id);
            }

            await loadSessionAttendance(sessionSelect.value);

        } catch (error) {
            console.error("Error loading training sessions:", error);

            sessionSelect.innerHTML = `
                <option value="">Unable to load sessions</option>
            `;

            sessionInfo.textContent = "Could not load training sessions.";
            playersBody.innerHTML = `
                <tr>
                    <td colspan="6" class="table-loading">
                        Could not connect to the backend. Make sure the TeamTrack server is running.
                    </td>
                </tr>
            `;

            sessionSelect.disabled = true;
            saveButton.disabled = true;
            showMessage(error.message || "Failed to load training sessions.", "error");
        }
    }

    async function loadSessionAttendance(sessionId) {
        if (!sessionId) {
            currentPlayers = [];
            sessionInfo.textContent = "Select a training session to see its details.";

            playersBody.innerHTML = `
                <tr>
                    <td colspan="6" class="table-loading">
                        Select a training session to load players.
                    </td>
                </tr>
            `;

            saveButton.disabled = true;
            updateStatistics();
            return;
        }

        saveButton.disabled = true;

        playersBody.innerHTML = `
            <tr>
                <td colspan="6" class="table-loading">
                    Loading players...
                </td>
            </tr>
        `;

        sessionInfo.textContent = "Loading session details...";
        showMessage("");

        try {
            const response = await fetch(
                `${API_BASE_URL}/attendance/session/${encodeURIComponent(sessionId)}`
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Could not load attendance.");
            }

            const session = data.session;
            currentPlayers = data.players || [];

            const time = session.start_time
                ? `${formatTime(session.start_time)}${session.end_time ? `–${formatTime(session.end_time)}` : ""}`
                : "Time not set";

            sessionInfo.textContent =
                `${formatDate(session.training_date)} · ${time} · ${session.location || "Location not set"}`;

            renderPlayers();

        } catch (error) {
            console.error("Error loading session attendance:", error);

            currentPlayers = [];
            updateStatistics();

            playersBody.innerHTML = `
                <tr>
                    <td colspan="6" class="table-loading">
                        Could not load players for this session.
                    </td>
                </tr>
            `;

            saveButton.disabled = true;
            showMessage(error.message || "Failed to load attendance.", "error");
        }
    }

    async function saveAttendance() {
        if (isSaving) return;

        const sessionId = Number(sessionSelect.value);

        if (!sessionId) {
            showMessage("Please select a training session first.", "error");
            return;
        }

        const rows = Array.from(
            playersBody.querySelectorAll("tr[data-player-id]")
        );

        const recordsToSave = rows
            .map(row => {
                const status = row.querySelector(".attendance-status").value;
                const arrivalTime = row.querySelector(".attendance-arrival").value;
                const note = row.querySelector(".attendance-note").value.trim();

                return {
                    player_id: Number(row.dataset.playerId),
                    training_session_id: sessionId,
                    status,
                    arrival_time: status === "Late" ? arrivalTime || null : null,
                    note: note || null
                };
            })
            // An unrecorded row is left untouched, not treated as an absence.
            .filter(record => record.status !== "");

        if (!recordsToSave.length) {
            showMessage("Choose a status for at least one player before saving.", "error");
            return;
        }

        isSaving = true;
        saveButton.disabled = true;
        resetButton.disabled = true;
        sessionSelect.disabled = true;
        saveButton.textContent = "Saving...";

        let saved = 0;
        const errors = [];

        try {
            for (const record of recordsToSave) {
                try {
                    const response = await fetch(`${API_BASE_URL}/attendance`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(record)
                    });

                    const data = await response.json();

                    if (!response.ok || !data.success) {
                        throw new Error(data.message || "Save failed.");
                    }

                    saved++;

                } catch (error) {
                    errors.push(
                        `Player ID ${record.player_id}: ${error.message}`
                    );
                }
            }

            if (errors.length === 0) {
                showMessage(
                    `Attendance saved successfully for ${saved} player${saved === 1 ? "" : "s"}.`,
                    "success"
                );
            } else {
                showMessage(
                    `Saved ${saved} of ${recordsToSave.length} records. Some records failed: ${errors.join(" | ")}`,
                    "error"
                );
            }

            // Reload the saved values from the database.
            await loadSessionAttendance(sessionId);

        } finally {
            isSaving = false;
            saveButton.textContent = "Save Attendance";
            resetButton.disabled = false;
            sessionSelect.disabled = false;
            saveButton.disabled = !sessionSelect.value || currentPlayers.length === 0;
        }
    }

    sessionSelect.addEventListener("change", () => {
        loadSessionAttendance(sessionSelect.value);
    });

    function openExcuseForm(row) {
    selectedExcuseRow = row;

    const player = currentPlayers.find(
        item => Number(item.player_id) === Number(row.dataset.playerId)
    );

    if (!player) {
        showMessage("Could not identify the selected player.", "error");
        return;
    }

    excuseSelectedPlayer.textContent =
        `${player.full_name || "Unnamed player"} · ${sessionInfo.textContent}`;

    excuseForm.reset();
    excuseOtherGroup.hidden = true;
    excuseOtherCategory.required = false;
    excuseMessage.textContent = "";
    excusePanel.hidden = false;

    excusePanel.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function closeExcuseForm() {
    excusePanel.hidden = true;
    excuseForm.reset();
    excuseOtherGroup.hidden = true;
    excuseOtherCategory.required = false;
    excuseMessage.textContent = "";
    selectedExcuseRow = null;
}

excuseCategory.addEventListener("change", () => {
    const isOther = excuseCategory.value === "Other";

    excuseOtherGroup.hidden = !isOther;
    excuseOtherCategory.required = isOther;

    if (!isOther) {
        excuseOtherCategory.value = "";
    }
});

cancelExcuseButton.addEventListener("click", () => {
    if (selectedExcuseRow) {
        const statusSelect =
            selectedExcuseRow.querySelector(".attendance-status");

        if (statusSelect && statusSelect.value === "Excused") {
            statusSelect.value = "";
            updateArrivalTimeInput(selectedExcuseRow);
            updateStatistics();
        }
    }

    closeExcuseForm();
});

playersBody.addEventListener("change", event => {
    if (!event.target.classList.contains("attendance-status")) {
        return;
    }

    const row = event.target.closest("tr");

    if (event.target.value === "Excused" && row) {
        openExcuseForm(row);
    } else if (
        selectedExcuseRow === row &&
        excusePanel.hidden === false
    ) {
        closeExcuseForm();
    }
});

excuseForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (isSavingExcuse) return;

    const sessionId = Number(sessionSelect.value);
    const playerId = selectedExcuseRow
        ? Number(selectedExcuseRow.dataset.playerId)
        : 0;

    if (!sessionId || !playerId) {
        excuseMessage.textContent =
            "Please select a player and training session.";
        return;
    }

    const outcome = excuseOutcome.value;
    const category = excuseCategory.value;
    const otherCategory = excuseOtherCategory.value.trim();

    if (!outcome || !category) {
        excuseMessage.textContent =
            "Please choose an attendance outcome and excuse category.";
        return;
    }

    if (category === "Other" && !otherCategory) {
        excuseMessage.textContent =
            "Please specify the other excuse category.";
        return;
    }

    const reason = `${outcome} — ${
        category === "Other" ? otherCategory : category
    }`;

    const payload = {
        player_id: playerId,
        training_session_id: sessionId,
        reason,
        explanation: excuseExplanation.value.trim(),
        evidence_path: excuseEvidence.value.trim()
    };

    isSavingExcuse = true;
    saveExcuseButton.disabled = true;
    saveExcuseButton.textContent = "Saving...";

    try {
        const response = await fetch(`${API_BASE_URL}/excuses`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok || data.success === false) {
            throw new Error(
                data.message || "Could not save the excuse request."
            );
        }

        excuseMessage.textContent =
            "Excuse request saved as Pending. Open the Excuses page to review it.";

        excuseMessage.className = "success";

        // Keep the attendance status as Excused while the request is pending.
        closeExcuseForm();

        showMessage(
            "Excuse request submitted successfully. Its status is Pending.",
            "success"
        );

    } catch (error) {
        console.error("Error saving excuse request:", error);

        excuseMessage.textContent =
            error.message || "Failed to save the excuse request.";

        excuseMessage.className = "error";

    } finally {
        isSavingExcuse = false;
        saveExcuseButton.disabled = false;
        saveExcuseButton.textContent = "Save Excuse Request";
    }
});

    playersBody.addEventListener("change", event => {
        if (
            event.target.classList.contains("attendance-status") ||
            event.target.classList.contains("attendance-arrival")
        ) {
            const row = event.target.closest("tr");

            if (row && event.target.classList.contains("attendance-status")) {
                updateArrivalTimeInput(row);
            }

            updateStatistics();
        }
    });

    playersBody.addEventListener("input", event => {
        if (
            event.target.classList.contains("attendance-status") ||
            event.target.classList.contains("attendance-arrival")
        ) {
            updateStatistics();
        }
    });

    saveButton.addEventListener("click", saveAttendance);

    resetButton.addEventListener("click", () => {
        if (sessionSelect.value) {
            loadSessionAttendance(sessionSelect.value);
        }
    });

    document.addEventListener("teamtrackMonthChanged", () => {
        loadSessions();
    });

    loadSessions();
});
