const EXCUSES_API_URL = "http://localhost:3000/api";

document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.getElementById("excusesTableBody");
    const statusFilter = document.getElementById("excuseStatusFilter");
    const message = document.getElementById("excusesMessage");

    const totalElement = document.getElementById("totalExcuses");
    const pendingElement = document.getElementById("pendingExcuses");
    const approvedElement = document.getElementById("approvedExcuses");
    const rejectedElement = document.getElementById("rejectedExcuses");

    const editPanel = document.getElementById("editExcusePanel");
    const editForm = document.getElementById("editExcuseForm");
    const editId = document.getElementById("editExcuseId");
    const editPlayer = document.getElementById("editExcusePlayer");
    const editReason = document.getElementById("editExcuseReason");
    const otherReasonGroup = document.getElementById("editOtherReasonGroup");
    const otherReasonInput = document.getElementById("editOtherReason");
    const editExplanation = document.getElementById("editExcuseExplanation");
    const editEvidence = document.getElementById("editExcuseEvidence");
    const cancelEditButton = document.getElementById("cancelEditExcuse");

    let allExcuses = [];
    let isLoading = false;
    let isSaving = false;

    // Standard reasons offered by the form.
    const STANDARD_REASONS = [
        "Medical",
        "Family",
        "Academic",
        "Personal"
    ];

    function selectedMonth() {
        if (typeof getSelectedTeamTrackMonth === "function") {
            return getSelectedTeamTrackMonth();
        }

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

    function showMessage(text, type = "") {
        message.textContent = text;
        message.className = type;
    }

    function updateStatistics() {
        totalElement.textContent = allExcuses.length;

        pendingElement.textContent = allExcuses.filter(
            excuse => excuse.status === "Pending"
        ).length;

        approvedElement.textContent = allExcuses.filter(
            excuse => excuse.status === "Approved"
        ).length;

        rejectedElement.textContent = allExcuses.filter(
            excuse => excuse.status === "Rejected"
        ).length;
    }

    function updateOtherReasonVisibility() {
        const isOther = editReason.value === "Other";

        otherReasonGroup.hidden = !isOther;
        otherReasonInput.required = isOther;

        if (!isOther) {
            otherReasonInput.value = "";
        }
    }

    function openEditForm(excuse) {
        if (excuse.status !== "Pending") {
            showMessage(
                "Only pending excuses can be edited.",
                "error"
            );
            return;
        }

        editId.value = excuse.id;
        editPlayer.value = excuse.full_name || "Unknown player";
        editExplanation.value = excuse.explanation || "";
        editEvidence.value = excuse.evidence_path || "";

        const savedReason = (excuse.reason || "").trim();

        if (!savedReason) {
            editReason.value = "";
            otherReasonInput.value = "";
        } else if (STANDARD_REASONS.includes(savedReason)) {
            editReason.value = savedReason;
            otherReasonInput.value = "";
        } else {
            editReason.value = "Other";
            otherReasonInput.value = savedReason;
        }

        updateOtherReasonVisibility();

        editPanel.hidden = false;
        showMessage("");

        editPanel.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    function closeEditForm() {
        editForm.reset();
        editId.value = "";
        editPanel.hidden = true;
        otherReasonGroup.hidden = true;
        otherReasonInput.required = false;
    }

    function renderExcuses() {
        const filter = statusFilter.value;

        const visibleExcuses = filter === "All"
            ? allExcuses
            : allExcuses.filter(excuse => excuse.status === filter);

        if (!visibleExcuses.length) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="table-loading">
                        ${
                            allExcuses.length
                                ? "No excuses match this status filter."
                                : "No excuse requests were found for this month."
                        }
                    </td>
                </tr>
            `;

            return;
        }

        tableBody.innerHTML = visibleExcuses.map(excuse => {
            const playerName = excuse.full_name || "Unknown player";
            const reason = excuse.reason || "Not known yet";
            const explanation = excuse.explanation || "No explanation provided";
            const status = excuse.status || "Pending";

            const evidenceCell = excuse.evidence_path
                ? `<span title="${escapeHTML(excuse.evidence_path)}">Evidence path recorded</span>`
                : "—";

            const actions = status === "Pending"
                ? `
                    <div class="excuse-actions">
                        <button
                            type="button"
                            class="secondary-button excuse-edit-button"
                            data-id="${Number(excuse.id)}"
                        >
                            Edit
                        </button>
                        <button
                            type="button"
                            class="secondary-button excuse-delete-button"
                            data-id="${Number(excuse.id)}"
                        >
                            Delete
                        </button>

                        <button
                            type="button"
                            class="primary-button excuse-review-button"
                            data-id="${Number(excuse.id)}"
                            data-status="Approved"
                        >
                            Approve
                        </button>

                        <button
                            type="button"
                            class="secondary-button excuse-review-button"
                            data-id="${Number(excuse.id)}"
                            data-status="Rejected"
                        >
                            Reject
                        </button>
                    </div>
                `
                : `<span>${status === "Approved" ? "Reviewed" : "Closed"}</span>`;

            return `
                <tr>
                    <td>
                        <strong>${escapeHTML(playerName)}</strong>
                        ${
                            excuse.jersey_name
                                ? `<br><small>${escapeHTML(excuse.jersey_name)}</small>`
                                : ""
                        }
                    </td>

                    <td>${escapeHTML(formatDate(excuse.training_date))}</td>

                    <td>${escapeHTML(reason)}</td>

                    <td class="excuse-explanation">
                        ${escapeHTML(explanation)}
                    </td>

                    <td>${evidenceCell}</td>

                    <td>
                        <span class="excuse-status status-${escapeHTML(status.toLowerCase())}">
                            ${escapeHTML(status)}
                        </span>
                    </td>

                    <td>${actions}</td>
                </tr>
            `;
        }).join("");
    }

    async function loadExcuses() {
        if (isLoading) return;

        isLoading = true;

        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="table-loading">
                    Loading excuse requests...
                </td>
            </tr>
        `;

        showMessage("");

        try {
            const month = selectedMonth();

            const response = await fetch(
                `${EXCUSES_API_URL}/excuses?month=${encodeURIComponent(month)}`
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Could not load excuses.");
            }

            allExcuses = Array.isArray(data.excuses)
                ? data.excuses
                : [];

            updateStatistics();
            renderExcuses();

        } catch (error) {
            console.error("Error loading excuses:", error);

            allExcuses = [];
            updateStatistics();

            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="table-loading">
                        Could not load excuse requests. Check that the backend is running.
                    </td>
                </tr>
            `;

            showMessage(
                error.message || "Failed to load excuses.",
                "error"
            );

        } finally {
            isLoading = false;
        }
    }

    async function saveEdit(event) {
        event.preventDefault();

        if (isSaving) return;

        const excuseId = Number(editId.value);

        if (!Number.isInteger(excuseId) || excuseId <= 0) {
            showMessage("Invalid excuse record.", "error");
            return;
        }

        let reason = editReason.value;

        if (reason === "Other") {
            reason = otherReasonInput.value.trim();

            if (!reason) {
                showMessage(
                    "Please specify the other reason.",
                    "error"
                );
                otherReasonInput.focus();
                return;
            }
        }

        isSaving = true;

        const saveButton = editForm.querySelector(
            'button[type="submit"]'
        );

        saveButton.disabled = true;
        showMessage("Saving changes...");

        try {
            const response = await fetch(
                `${EXCUSES_API_URL}/excuses/${excuseId}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        reason,
                        explanation: editExplanation.value.trim(),
                        evidence_path: editEvidence.value.trim()
                    })
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Could not save excuse changes."
                );
            }

            closeEditForm();

            showMessage(
                data.message || "Excuse updated successfully.",
                "success"
            );

            await loadExcuses();

        } catch (error) {
            console.error("Error saving excuse:", error);

            showMessage(
                error.message || "Failed to save excuse.",
                "error"
            );

        } finally {
            isSaving = false;
            saveButton.disabled = false;
        }
    }

    async function reviewExcuse(excuseId, newStatus, button) {
        if (!["Approved", "Rejected"].includes(newStatus)) return;

        const action = newStatus === "Approved" ? "approve" : "reject";

        if (!window.confirm(`Are you sure you want to ${action} this excuse?`)) {
            return;
        }

        button.disabled = true;
        showMessage("Updating excuse request...");

        try {
            const response = await fetch(
                `${EXCUSES_API_URL}/excuses/${excuseId}/status`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        status: newStatus,
                        reviewed_by: "Team Manager"
                    })
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Could not update excuse."
                );
            }

            closeEditForm();

            showMessage(
                data.message || "Excuse updated successfully.",
                "success"
            );

            await loadExcuses();

        } catch (error) {
            console.error("Error reviewing excuse:", error);

            showMessage(
                error.message || "Failed to review excuse.",
                "error"
            );

        } finally {
            button.disabled = false;
        }
    }
    async function deleteExcuse(excuseId, button) {
        const confirmed = window.confirm(
            "Are you sure you want to delete this pending excuse? This action cannot be undone."
        );

        if (!confirmed) return;

        button.disabled = true;
        showMessage("Deleting excuse request...");

        try {
            const response = await fetch(
                `${EXCUSES_API_URL}/excuses/${excuseId}`,
                {
                    method: "DELETE"
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Could not delete excuse."
                );
            }

            closeEditForm();

            showMessage(
                data.message || "Excuse deleted successfully.",
                "success"
            );

            await loadExcuses();

        } catch (error) {
            console.error("Error deleting excuse:", error);

            showMessage(
                error.message || "Failed to delete excuse.",
                "error"
            );

        } finally {
            button.disabled = false;
        }
    }

    editReason.addEventListener(
        "change",
        updateOtherReasonVisibility
    );

    editForm.addEventListener("submit", saveEdit);

    cancelEditButton.addEventListener("click", () => {
        closeEditForm();
        showMessage("");
    });

    statusFilter.addEventListener("change", renderExcuses);

    tableBody.addEventListener("click", event => {
        const editButton = event.target.closest(".excuse-edit-button");

        if (editButton) {
            const excuse = allExcuses.find(
                item => Number(item.id) === Number(editButton.dataset.id)
            );

            if (excuse) {
                openEditForm(excuse);
            }

            return;
        }

        const deleteButton = event.target.closest(".excuse-delete-button");

            if (deleteButton) {
                deleteExcuse(
                    Number(deleteButton.dataset.id),
                    deleteButton
                );
                return;
            }

        const reviewButton = event.target.closest(
            ".excuse-review-button"
        );

        if (!reviewButton) return;

        reviewExcuse(
            Number(reviewButton.dataset.id),
            reviewButton.dataset.status,
            reviewButton
        );
    });

    document.addEventListener("teamtrackMonthChanged", () => {
        closeEditForm();
        loadExcuses();
    });

    loadExcuses();
});