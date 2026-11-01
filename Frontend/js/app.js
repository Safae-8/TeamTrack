document.addEventListener("DOMContentLoaded", () => {
    initializeDashboard();
    initializeNavigation();
    initializeActionButtons();
    loadDashboardPlayers();
    loadDashboardTeamRules();
});

document.addEventListener("componentsLoaded", () => {
    initializeMonthSelector();
});


/* =========================================================
   DASHBOARD TEAM RULES
   ========================================================= */

async function loadDashboardTeamRules() {
    const lateElement = document.getElementById("dashboardLateThreshold");
    const absenceElement = document.getElementById("dashboardAbsenceThreshold");
    const fineElement = document.getElementById("dashboardFineAmount");

    // Only run on the Dashboard.
    if (!lateElement || !absenceElement || !fineElement) {
        return;
    }

    try {
        const response = await fetch("http://localhost:3000/api/settings");
        const data = await response.json();

        if (!response.ok || !data.success || !data.settings) {
            throw new Error(data.message || "Could not load team rules.");
        }

        const settings = data.settings;
        const lateThreshold = Number(settings.late_threshold);
        const absenceThreshold = Number(settings.monthly_absence_threshold);
        const fineAmount = Number(settings.fine_per_late);

        if (
            !Number.isInteger(lateThreshold) || lateThreshold < 1 ||
            !Number.isInteger(absenceThreshold) || absenceThreshold < 1 ||
            !Number.isFinite(fineAmount) || fineAmount < 0
        ) {
            throw new Error("The saved team rules are invalid.");
        }

        lateElement.textContent = `Late ${lateThreshold} times`;
        absenceElement.textContent = `${absenceThreshold} qualifying absences`;
        fineElement.textContent = `Late fine: ¥${fineAmount.toFixed(2)}`;

        const lateDescription = document.getElementById("dashboardLateDescription");
        const fineDescription = document.getElementById("dashboardFineDescription");

        if (lateDescription) {
            lateDescription.textContent =
                `Counts as 1 qualifying absence for every ${lateThreshold} late arrivals`;
        }

        if (fineDescription) {
            fineDescription.textContent =
                `¥${fineAmount.toFixed(2)} for every late attendance`;
        }
    } catch (error) {
        console.error("Error loading dashboard team rules:", error);
    }
}


/* =========================================================
   DASHBOARD INITIALIZATION
   ========================================================= */

function initializeDashboard() {
    console.log("TeamTrack dashboard loaded.");

    updateCurrentDate();
}


/* =========================================================
   SIDEBAR NAVIGATION
   ========================================================= */

function initializeNavigation() {
    const navLinks = document.querySelectorAll(".nav-link");

    navLinks.forEach((link) => {

        link.addEventListener("click", () => {

            const pageName =
                link.dataset.page ||
                link.textContent.trim();

            console.log(`Navigation selected: ${pageName}`);

        });

    });
}



/* =========================================================
   MONTH SELECTOR
   ========================================================= */

const TEAMTRACK_MONTH_KEY = "teamtrackSelectedMonth";

function getSelectedTeamTrackMonth() {
    const savedMonth = localStorage.getItem(TEAMTRACK_MONTH_KEY);

    if (savedMonth && /^\d{4}-\d{2}$/.test(savedMonth)) {
        return savedMonth;
    }

    const today = new Date();

    return `${today.getFullYear()}-${String(
        today.getMonth() + 1
    ).padStart(2, "0")}`;
}

function setSelectedTeamTrackMonth(month) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
        return;
    }

    localStorage.setItem(TEAMTRACK_MONTH_KEY, month);

    document.dispatchEvent(
        new CustomEvent("teamtrackMonthChanged", {
            detail: { month }
        })
    );
}

function initializeMonthSelector() {
    const monthNames = [
        "January", "February", "March", "April",
        "May", "June", "July", "August",
        "September", "October", "November", "December"
    ];

    const selectedMonthElement =
        document.querySelector("#selectedMonth");

    const monthPickerTitle =
        document.querySelector("#monthPickerTitle");

    const monthPickerGrid =
        document.querySelector("#monthPickerGrid");

    const monthPicker =
        document.querySelector("#monthPicker");

    const monthSelectorButton =
        document.querySelector("#monthSelectorButton");

    if (
        !selectedMonthElement ||
        !monthPickerTitle ||
        !monthPickerGrid ||
        !monthPicker ||
        !monthSelectorButton
    ) {
        return;
    }

    // Read the shared month, or default to the current month.
    let selectedMonth = getSelectedTeamTrackMonth();
    let [selectedYear, selectedMonthNumber] =
        selectedMonth.split("-").map(Number);

    let selectedDate = new Date(
        selectedYear,
        selectedMonthNumber - 1,
        1
    );

    function updateMonthDisplay() {
        const month = monthNames[selectedDate.getMonth()];
        const year = selectedDate.getFullYear();

        selectedMonthElement.textContent = `${month} ${year}`;
        monthPickerTitle.textContent = `${year}`;
    }

    function renderMonths() {
        const currentMonth = selectedDate.getMonth();

        monthPickerGrid.innerHTML = monthNames.map((month, index) => {
            const selected =
                index === currentMonth ? "selected" : "";

            return `
                <button
                    type="button"
                    class="${selected}"
                    data-month="${index}"
                >
                    ${month}
                </button>
            `;
        }).join("");
    }

    function saveSelectedMonth() {
        const month = `${selectedDate.getFullYear()}-${String(
            selectedDate.getMonth() + 1
        ).padStart(2, "0")}`;

        setSelectedTeamTrackMonth(month);
    }

    updateMonthDisplay();
    renderMonths();

    // Delegate clicks because the shared topbar is dynamically injected.
    document.addEventListener("click", (event) => {
        if (event.target.closest("#monthSelectorButton")) {
            event.stopPropagation();
            monthPicker.classList.toggle("show");
            return;
        }

        if (event.target.closest("#previousMonth")) {
            event.stopPropagation();

            selectedDate.setFullYear(
                selectedDate.getFullYear() - 1
            );

            updateMonthDisplay();
            renderMonths();
            saveSelectedMonth();
            return;
        }

        if (event.target.closest("#nextMonth")) {
            event.stopPropagation();

            selectedDate.setFullYear(
                selectedDate.getFullYear() + 1
            );

            updateMonthDisplay();
            renderMonths();
            saveSelectedMonth();
            return;
        }

        const monthButton =
            event.target.closest("#monthPickerGrid button");

        if (monthButton) {
            event.stopPropagation();

            selectedDate = new Date(
                selectedDate.getFullYear(),
                Number(monthButton.dataset.month),
                1
            );

            updateMonthDisplay();
            renderMonths();
            monthPicker.classList.remove("show");
            saveSelectedMonth();
            return;
        }

        if (!event.target.closest("#monthPicker")) {
            monthPicker.classList.remove("show");
        }
    });
}



/* =========================================================
   QUICK ACTION BUTTONS
   ========================================================= */

function initializeActionButtons() {
    const actionButtons = document.querySelectorAll("[data-action]");

    actionButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const action = button.dataset.action;

            handleAction(action);
        });
    });
}


function handleAction(action) {
    switch (action) {

        case "attendance":
            console.log("Take Attendance selected.");
            break;

        case "add-player":
            console.log("Add Player selected.");
            break;

        case "schedule-training":
            console.log("Schedule Training selected.");
            break;

        case "monthly-report":
            console.log("Monthly Report selected.");
            break;

        default:
            console.log(`Unknown action: ${action}`);
    }
}


/* =========================================================
   CURRENT DATE
   ========================================================= */

function updateCurrentDate() {
    const dateElements = document.querySelectorAll("[data-current-date]");

    if (!dateElements.length) {
        return;
    }

    const today = new Date();

    const formattedDate = today.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });

    dateElements.forEach((element) => {
        element.textContent = formattedDate;
    });
}

async function loadDashboardPlayers() {

    const tableBody = document.querySelector("#dashboardPlayersBody");

    if (!tableBody) return;

    try {

        const response = await fetch("http://localhost:3000/api/players");

        if (!response.ok) {
            throw new Error("Failed to load players.");
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || "Failed to load players.");
        }

        const players = data.players;
        const playerCountElement = document.querySelector("#dashboardPlayerCount");

        if (playerCountElement) {
            playerCountElement.textContent = players.length;
        }

        if (players.length === 0) {

            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="table-loading">
                        No players registered yet.
                    </td>
                </tr>
            `;

            return;
        }

        // Show the first 5 players on the dashboard
        const recentPlayers = players.slice(0, 5);

        tableBody.innerHTML = recentPlayers.map((player, index) => {

            return `
                <tr>

                    <td>
                        ${String(index + 1).padStart(2, "0")}
                    </td>

                    <td>
                        ${escapeHtml(player.full_name)}
                    </td>

                    <td>
                        ${player.position
                            ? escapeHtml(player.position)
                            : "—"}
                    </td>

                    <td>—</td>

                    <td>—</td>

                    <td>¥0</td>

                    <td>
                        <span class="status ${
                            player.status === "Active"
                                ? "active-status"
                                : "warning-status"
                        }">
                            ${escapeHtml(player.status)}
                        </span>
                    </td>

                </tr>
            `;

        }).join("");

    } catch (error) {

        console.error("Error loading dashboard players:", error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="table-loading">
                    Failed to load players.
                </td>
            </tr>
        `;
    }
}

function escapeHtml(value) {
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


document.addEventListener("DOMContentLoaded", () => {
    const openButton = document.getElementById("dashboardAddPlayerButton");
    const modal = document.getElementById("playerModal");
    const form = document.getElementById("playerForm");
    const closeButton = document.getElementById("closePlayerModal");
    const cancelButton = document.getElementById("cancelPlayerButton");
    const message = document.getElementById("playerFormMessage");
    const statusGroup = document.getElementById("statusGroup");

    // This code runs only on pages containing the dashboard modal.
    if (!openButton || !modal || !form) return;

    function openModal() {
        form.reset();
        document.getElementById("playerId").value = "";
        document.getElementById("playerModalTitle").textContent = "Add Player";
        if (statusGroup) statusGroup.style.display = "none";

        message.textContent = "";
        message.className = "form-message";

        // Default join date to today using local time.
        const today = new Date();
        const localDate = [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, "0"),
            String(today.getDate()).padStart(2, "0")
        ].join("-");

        document.getElementById("joinDate").value = localDate;
        modal.classList.add("show");
    }

    function closeModal() {
        modal.classList.remove("show");
    }

    openButton.addEventListener("click", openModal);
    closeButton?.addEventListener("click", closeModal);
    cancelButton?.addEventListener("click", closeModal);

    modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal();
    });

    // Save the new player using the existing backend API.
    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const playerData = {
            full_name: document.getElementById("fullName").value.trim(),
            jersey_name: document.getElementById("jerseyName").value.trim() || null,
            student_id: document.getElementById("studentId").value.trim() || null,
            phone: document.getElementById("phone").value.trim() || null,
            position: document.getElementById("position").value || null,
            jersey_number: document.getElementById("jerseyNumber").value
                ? Number(document.getElementById("jerseyNumber").value)
                : null,
            join_date: document.getElementById("joinDate").value,
            status: "Active"
        };

        if (!playerData.full_name || !playerData.join_date) {
            message.textContent = "Please enter the player's name and join date.";
            message.className = "form-message error";
            return;
        }

        const saveButton = form.querySelector('button[type="submit"]');
        saveButton.disabled = true;
        saveButton.textContent = "Saving...";

        try {
            const response = await fetch("/api/players", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(playerData)
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to save player.");
            }

            closeModal();
            form.reset();
            alert("Player added successfully!");

        } catch (error) {
            message.textContent = error.message || "Failed to save player.";
            message.className = "form-message error";
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = "Save Player";
        }
    });
});
