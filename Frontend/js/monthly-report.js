const API_BASE_URL = "http://localhost:3000/api";

document.addEventListener("DOMContentLoaded", () => {
    const reportBody = document.getElementById("monthlyReportBody");
    const message = document.getElementById("monthlyReportMessage");

    const totalPlayersElement = document.getElementById("reportTotalPlayers");
    const presentElement = document.getElementById("reportPresent");
    const lateElement = document.getElementById("reportLate");
    const absencesElement = document.getElementById("reportAbsences");

    function getCurrentMonth() {
        if (typeof getSelectedTeamTrackMonth === "function") {
            return getSelectedTeamTrackMonth();
        }

        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function showMessage(text, type = "") {
        message.textContent = text;
        message.className = type;
    }

    async function fetchJSON(url) {
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok || data.success === false) {
            throw new Error(data.message || "Could not load report data.");
        }

        return data;
    }

    async function loadReport() {
        reportBody.innerHTML = `
            <tr>
                <td colspan="8" class="table-loading">
                    Loading monthly report...
                </td>
            </tr>
        `;

        showMessage("");

        try {
            const month = getCurrentMonth();

            
            const [playersData, attendanceData, excusesData, settingsData] = await Promise.all([
                fetchJSON(`${API_BASE_URL}/players`),
                fetchJSON(`${API_BASE_URL}/attendance?month=${encodeURIComponent(month)}`),
                fetchJSON(`${API_BASE_URL}/excuses?month=${encodeURIComponent(month)}`),
                fetchJSON(`${API_BASE_URL}/settings`)
            ]);

            const settings = settingsData.settings;

            const lateThreshold = Number(settings.late_threshold);
            const monthlyAbsenceThreshold = Number(settings.monthly_absence_threshold);

            if (
                !Number.isInteger(lateThreshold) ||
                lateThreshold < 1 ||
                !Number.isInteger(monthlyAbsenceThreshold) ||
                monthlyAbsenceThreshold < 1
            ) {
                throw new Error("The saved attendance rules are invalid.");
            }


            const players = Array.isArray(playersData)
                ? playersData
                : playersData.players || [];

            const attendance = attendanceData.attendance || [];
            const excuses = excusesData.excuses || [];

            const summaries = new Map();

            players.forEach(player => {
                summaries.set(Number(player.id), {
                    id: Number(player.id),
                    name: player.full_name || "Unnamed player",
                    present: 0,
                    late: 0,
                    absent: 0,
                    excused: 0,
                    approvedExcuses: 0,
                    unexcusedAbsences: 0,
                    qualifyingAbsences: 0
                });
            });

            // Count attendance records for the selected month.
            attendance.forEach(record => {
                const summary = summaries.get(Number(record.player_id));

                if (!summary) return;

                if (record.status === "Present") {
                    summary.present++;
                } else if (record.status === "Late") {
                    summary.late++;
                } else if (record.status === "Absent") {
                    summary.absent++;
                } else if (record.status === "Excused") {
                    summary.excused++;
                }
            });

            // Index excuse requests by player and training session.
            const excuseBySession = new Map();

            excuses.forEach(excuse => {
                const key = `${Number(excuse.player_id)}-${Number(excuse.training_session_id)}`;
                const existing = excuseBySession.get(key);

                // Prefer a reviewed request if unexpected duplicates exist.
                if (!existing || excuse.status !== "Pending") {
                    excuseBySession.set(key, excuse);
                }
            });

            // Count approved excuses and determine unexcused absences.
            attendance.forEach(record => {
                const summary = summaries.get(Number(record.player_id));

                if (!summary) return;

                const key = `${Number(record.player_id)}-${Number(record.training_session_id)}`;
                const excuse = excuseBySession.get(key);

                if (excuse && excuse.status === "Approved") {
                    summary.approvedExcuses++;
                }

                if (record.status === "Absent") {
                    if (!excuse || excuse.status === "Rejected") {
                        summary.unexcusedAbsences++;
                    }
                }
            });

            let totalPresent = 0;
            let totalLate = 0;
            let totalUnexcused = 0;

            summaries.forEach(summary => {
                summary.qualifyingAbsences =
                    summary.unexcusedAbsences + Math.floor(summary.late / lateThreshold);

                totalPresent += summary.present;
                totalLate += summary.late;
                totalUnexcused += summary.unexcusedAbsences;
            });

            totalPlayersElement.textContent = summaries.size;
            presentElement.textContent = totalPresent;
            lateElement.textContent = totalLate;
            absencesElement.textContent = totalUnexcused;

            if (!summaries.size) {
                reportBody.innerHTML = `
                    <tr>
                        <td colspan="8" class="table-loading">
                            No players found.
                        </td>
                    </tr>
                `;
                return;
            }

            reportBody.innerHTML = Array.from(summaries.values())
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((summary, index) => {
                    const reviewRequired =
                        summary.qualifyingAbsences >= monthlyAbsenceThreshold;

                    return `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${escapeHTML(summary.name)}</td>
                            <td>${summary.present}</td>
                            <td>${summary.late}</td>
                            <td>${summary.unexcusedAbsences}</td>
                            <td>${summary.approvedExcuses}</td>
                            <td>${summary.qualifyingAbsences}</td>
                            <td>
                                <span class="${reviewRequired ? "status-rejected" : "status-approved"}">
                                    ${reviewRequired ? "Review Required" : "Good Standing"}
                                </span>
                            </td>
                        </tr>
                    `;
                }).join("");

            showMessage(`Monthly report loaded for ${month}.`, "success");

        } catch (error) {
            console.error("Error loading monthly report:", error);

            reportBody.innerHTML = `
                <tr>
                    <td colspan="8" class="table-loading">
                        Could not load the monthly report.
                    </td>
                </tr>
            `;

            showMessage(error.message || "Failed to load monthly report.", "error");
        }
    }

    document.addEventListener("teamtrackMonthChanged", loadReport);

    loadReport();
});
