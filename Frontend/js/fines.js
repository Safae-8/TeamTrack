
const FINES_API_URL = "http://localhost:3000/api";
const FINE_PER_LATE = 10;

document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.getElementById("finesTableBody");
    const totalLateElement = document.getElementById("finesTotalLate");
    const totalAmountElement = document.getElementById("finesTotalAmount");
    const playersCountElement = document.getElementById("finesPlayersCount");
    const messageElement = document.getElementById("finesMessage");

    let currentFines = [];

    function getSelectedMonth() {
        if (typeof getSelectedTeamTrackMonth === "function") {
            return getSelectedTeamTrackMonth();
        }

        const savedMonth = localStorage.getItem("teamtrackSelectedMonth");

        if (savedMonth) return savedMonth;

        const now = new Date();
        return `${now.getFullYear()}-${String(
            now.getMonth() + 1
        ).padStart(2, "0")}`;
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

    async function fetchJSON(url, options = {}) {
        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok || data.success === false) {
            throw new Error(data.message || "Request failed.");
        }

        return data;
    }

    function showMessage(text, type = "") {
        messageElement.textContent = text;
        messageElement.className = type;
    }

    function renderFines() {
        const totalLate = currentFines.length;

        const totalAmount = currentFines.reduce(
            (sum, fine) => sum + Number(fine.amount),
            0
        );

        const playersWithFines = new Set(
            currentFines.map(fine => Number(fine.player_id))
        ).size;

        totalLateElement.textContent = totalLate;
        totalAmountElement.textContent = `¥${totalAmount.toFixed(2)}`;
        playersCountElement.textContent = playersWithFines;

        if (currentFines.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="table-loading">
                        No fines found for this month.
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = currentFines.map((fine, index) => {
            const playerName = fine.jersey_name || fine.full_name || "Unknown player";
            const date = fine.training_date
                ? String(fine.training_date).slice(0, 10)
                : "—";

            const paid = fine.payment_status === "Paid";

            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>${escapeHTML(playerName)}</td>
                    <td>${escapeHTML(date)}</td>
                    <td>¥${Number(fine.amount).toFixed(2)}</td>
                    <td>
                        <span class="${paid ? "status-approved" : "status-rejected"}">
                            ${paid ? "Paid" : "Unpaid"}
                        </span>
                    </td>
                    <td>
                        <button
                            type="button"
                            class="btn ${paid ? "btn-secondary" : "btn-primary"}"
                            data-fine-id="${Number(fine.id)}"
                            data-next-status="${paid ? "Unpaid" : "Paid"}"
                        >
                            Mark ${paid ? "Unpaid" : "Paid"}
                        </button>
                    </td>
                </tr>
            `;
        }).join("");
    }

    async function loadFines() {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="table-loading">Loading fines...</td>
            </tr>
        `;

        showMessage("");

        try {
            const month = getSelectedMonth();

            const data = await fetchJSON(
                `${FINES_API_URL}/fines?month=${encodeURIComponent(month)}`
            );

            currentFines = data.fines || [];
            renderFines();

            showMessage(`Fines loaded for ${month}.`, "success");
        } catch (error) {
            console.error("Error loading fines:", error);

            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="table-loading">
                        Could not load fines.
                    </td>
                </tr>
            `;

            showMessage(error.message || "Failed to load fines.", "error");
        }
    }

    async function generateFines() {
        const month = getSelectedMonth();

        try {
            showMessage("Generating missing fines...");

            await fetchJSON(`${FINES_API_URL}/fines/generate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ month })
            });

            await loadFines();
            showMessage(`Fines updated for ${month}.`, "success");
        } catch (error) {
            console.error("Error generating fines:", error);
            showMessage(error.message || "Could not generate fines.", "error");
        }
    }

    tableBody.addEventListener("click", async event => {
        const button = event.target.closest("[data-fine-id]");

        if (!button) return;

        const fineId = button.dataset.fineId;
        const nextStatus = button.dataset.nextStatus;

        button.disabled = true;

        try {
            await fetchJSON(
                `${FINES_API_URL}/fines/${fineId}/payment`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        payment_status: nextStatus
                    })
                }
            );

            await loadFines();
            showMessage(`Fine marked ${nextStatus}.`, "success");
        } catch (error) {
            console.error("Error updating payment:", error);
            showMessage(error.message || "Could not update payment.", "error");
            button.disabled = false;
        }
    });

    // Add a Generate Fines button if the page includes its container.
    const generateButton = document.getElementById("generateFinesButton");

    if (generateButton) {
        generateButton.addEventListener("click", generateFines);
    }

    document.addEventListener("teamtrackMonthChanged", loadFines);

    // Load saved fines first. Generation is a separate, deliberate action.
    loadFines();
});
