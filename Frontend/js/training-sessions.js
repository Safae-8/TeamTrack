console.log("TRAINING SESSIONS JS LOADED");
document.addEventListener("DOMContentLoaded", () => {
    initializeTrainingPage();
});

let trainingSessions = [];
let editingSessionId = null;

const TRAINING_API = "http://localhost:3000/api/training-sessions";
const SCHEDULE_API = "http://localhost:3000/api/training-schedule";

async function initializeTrainingPage() {
    initializeTrainingModal();
    initializeTrainingForm();
    initializeTrainingMonthFilter();
    await loadTrainingSessions();
}

function initializeTrainingModal() {
    console.log("INITIALIZING TRAINING MODAL");
    const modal = document.querySelector("#trainingModal");
    console.log("Modal element:", modal);
    console.log(
        "Schedule button:",
        document.querySelector("#openTrainingModal")
    );
    const openButton = document.querySelector("#openTrainingModal");
    const closeButton = document.querySelector("#closeTrainingModal");
    const cancelButton = document.querySelector("#cancelTraining");

    if (!modal || !openButton || !closeButton || !cancelButton) {
        console.error("Training modal elements are missing.");
        return;
    }

    openButton.addEventListener("click", () => {
        resetTrainingForm();
        document.querySelector("#trainingModalTitle").textContent =
            "Schedule Training";
        modal.classList.add("active");
    });

    closeButton.addEventListener("click", closeTrainingModal);
    cancelButton.addEventListener("click", closeTrainingModal);

    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            closeTrainingModal();
        }
    });
}

function closeTrainingModal() {
    document.querySelector("#trainingModal").classList.remove("active");
}

function resetTrainingForm() {
    editingSessionId = null;
    document.querySelector("#trainingForm").reset();
    document.querySelector("#trainingFormMessage").textContent = "";
    document.querySelector("#saveTrainingButton").textContent = "Save Training";
}

function initializeTrainingForm() {
    const form = document.querySelector("#trainingForm");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const trainingDate = document.querySelector("#trainingDate").value;
        const startTime = document.querySelector("#trainingStartTime").value;
        const endTime = document.querySelector("#trainingEndTime").value;

        const message = document.querySelector("#trainingFormMessage");

        if (startTime && endTime && endTime <= startTime) {
            message.textContent = "End time must be later than start time.";
            message.style.color = "#ff647c";
            return;
        }

        const sessionData = {
            training_date: trainingDate,
            start_time: startTime || null,
            end_time: endTime || null,
            location: document.querySelector("#trainingLocation").value.trim() || null,
            notes: document.querySelector("#trainingNotes").value.trim() || null
        };

        const saveButton = document.querySelector("#saveTrainingButton");
        saveButton.disabled = true;
        message.textContent = "Saving...";
        message.style.color = "";

        try {
            const url = editingSessionId
                ? `${TRAINING_API}/${editingSessionId}`
                : TRAINING_API;

            const response = await fetch(url, {
                method: editingSessionId ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(sessionData)
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to save training session.");
            }

            const wasEditing = editingSessionId !== null;

            closeTrainingModal();
            resetTrainingForm();

            window.alert(
                wasEditing
                    ? "Training session updated successfully!"
                    : "Training session saved successfully!"
            );

            await loadTrainingSessions();

        } catch (error) {
            console.error("Error saving training session:", error);
            message.textContent = error.message || "Failed to save training session.";
            message.style.color = "#ff647c";
        } finally {
            saveButton.disabled = false;
        }
    });
}



function initializeTrainingMonthFilter() {
    const filter = document.querySelector("#trainingMonthFilter");

    if (!filter) {
        return;
    }

    // Use the month selected in the shared topbar.
    const sharedMonth =
        typeof getSelectedTeamTrackMonth === "function"
            ? getSelectedTeamTrackMonth()
            : "";

    if (sharedMonth) {
        filter.value = sharedMonth;
    } else {
        const now = new Date();

        filter.value = `${now.getFullYear()}-${String(
            now.getMonth() + 1
        ).padStart(2, "0")}`;
    }

    // When the Training Sessions month changes, update the shared month.
    filter.addEventListener("change", () => {
        const month = filter.value;

        if (!month) {
            return;
        }

        if (typeof setSelectedTeamTrackMonth === "function") {
            setSelectedTeamTrackMonth(month);
        }

        loadTrainingSessions();
    });

    // When the topbar month changes, update the filter and reload sessions.
    document.addEventListener("teamtrackMonthChanged", (event) => {
        const month = event.detail?.month;

        if (!month || filter.value === month) {
            return;
        }

        filter.value = month;
        loadTrainingSessions();
    });
}



async function loadTrainingSessions() {
    const tableBody = document.querySelector("#trainingSessionsBody");
    const month = document.querySelector("#trainingMonthFilter").value;

    tableBody.innerHTML = `
        <tr>
            <td colspan="5" class="table-loading">
                Preparing this month's training sessions...
            </td>
        </tr>
    `;

    try {
        // Generate any missing sessions from the saved weekly rules.
        if (month) {
            const generateResponse = await fetch(
                `${SCHEDULE_API}/generate-month`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ month })
                }
            );

            const generateResult = await generateResponse.json();

            if (!generateResponse.ok || !generateResult.success) {
                throw new Error(
                    generateResult.message ||
                    "Unable to generate scheduled sessions."
                );
            }

            console.log("Monthly schedule generation:", generateResult);
        }

        // Load the sessions for the selected month.
        const url = month
            ? `${TRAINING_API}?month=${encodeURIComponent(month)}`
            : TRAINING_API;

        const response = await fetch(url);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Unable to load training sessions."
            );
        }

        trainingSessions = result.sessions;
        displayTrainingSessions(trainingSessions);
        updateTrainingStatistics(trainingSessions);

    } catch (error) {
        console.error("Error loading training sessions:", error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="table-loading">
                    ${escapeTrainingHtml(
                        error.message ||
                        "Failed to load sessions. Check that the backend is running."
                    )}
                </td>
            </tr>
        `;
    }
}

function displayTrainingSessions(sessions) {
    const tableBody = document.querySelector("#trainingSessionsBody");

    if (sessions.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="table-loading">
                    No training sessions found for this month.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = sessions.map((session) => `
        <tr>
            <td>${escapeTrainingHtml(formatTrainingDate(session.training_date))}</td>
            <td>${escapeTrainingHtml(formatTrainingTime(session.start_time, session.end_time))}</td>
            <td>${escapeTrainingHtml(session.location || "—")}</td>
            <td>${escapeTrainingHtml(session.notes || "—")}</td>
            <td>
                <div class="player-actions">
                    <button type="button" class="edit-training-btn" data-id="${session.id}">
                        Edit
                    </button>
                    <button type="button" class="delete-training-btn" data-id="${session.id}">
                        Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join("");

    tableBody.querySelectorAll(".edit-training-btn").forEach((button) => {
        button.addEventListener("click", () => {
            editTrainingSession(Number(button.dataset.id));
        });
    });

    tableBody.querySelectorAll(".delete-training-btn").forEach((button) => {
        button.addEventListener("click", () => {
            deleteTrainingSession(Number(button.dataset.id));
        });
    });
}

function updateTrainingStatistics(sessions) {
    const totalElement = document.querySelector("#totalSessions");
    const monthlyElement = document.querySelector("#monthlySessions");
    const upcomingElement = document.querySelector("#upcomingSessions");

    const selectedMonth = document.querySelector("#trainingMonthFilter").value;
    const today = getLocalDateString();

    // The API response is already filtered by month when a month is selected.
    // Fetching all sessions is handled separately when updating the total.
    if (monthlyElement) {
        monthlyElement.textContent = sessions.length;
    }

    if (totalElement) {
        totalElement.textContent = sessions.length;
    }

    if (upcomingElement) {
        upcomingElement.textContent = sessions.filter((session) => {
            const date = String(session.training_date).slice(0, 10);
            return date >= today;
        }).length;
    }
}

function editTrainingSession(sessionId) {
    const session = trainingSessions.find((item) => item.id === sessionId);

    if (!session) {
        return;
    }

    editingSessionId = sessionId;

    document.querySelector("#trainingDate").value =
        String(session.training_date).slice(0, 10);

    document.querySelector("#trainingStartTime").value =
        session.start_time ? String(session.start_time).slice(0, 5) : "";

    document.querySelector("#trainingEndTime").value =
        session.end_time ? String(session.end_time).slice(0, 5) : "";

    document.querySelector("#trainingLocation").value = session.location || "";
    document.querySelector("#trainingNotes").value = session.notes || "";

    document.querySelector("#trainingModalTitle").textContent = "Edit Training Session";
    document.querySelector("#saveTrainingButton").textContent = "Save Changes";
    document.querySelector("#trainingFormMessage").textContent = "";

    document.querySelector("#trainingModal").classList.add("active");
}

async function deleteTrainingSession(sessionId) {
    const confirmed = window.confirm(
        "Delete this training session? Sessions with attendance records cannot be deleted."
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`${TRAINING_API}/${sessionId}`, {
            method: "DELETE"
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Unable to delete session.");
        }

        await loadTrainingSessions();

    } catch (error) {
        console.error("Error deleting training session:", error);
        window.alert(error.message || "Failed to delete training session.");
    }
}


function formatTrainingDate(value) {
    if (!value) {
        return "—";
    }

    // The API serializes MySQL DATE values as timestamps.
    // Convert the timestamp back to the intended calendar date.
    const dateString = String(value).slice(0, 10);
    const [year, month, day] = dateString.split("-").map(Number);

    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function formatTrainingTime(start, end) {
    if (!start && !end) {
        return "Not specified";
    }

    const format = (value) => value ? String(value).slice(0, 5) : "—";

    return `${format(start)} – ${format(end)}`;
}

function getLocalDateString() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function escapeTrainingHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}