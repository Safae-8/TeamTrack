document.addEventListener("DOMContentLoaded", () => {
    loadPlayers();
    initializePlayerModal();
    initializePlayerForm();
    initializePlayerSearch();
});


// ==========================================
// LOAD PLAYERS
// ==========================================

async function loadPlayers() {
    const tableBody = document.querySelector("#playersTableBody");

    try {
        const response = await fetch("/api/players");
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || "Failed to load players.");
        }

        displayPlayers(data.players);
        updatePlayerStatistics(data.players);

    } catch (error) {
        console.error("Error loading players:", error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="table-error">
                    Failed to load players.
                </td>
            </tr>
        `;
    }
}


// ==========================================
// DISPLAY PLAYERS
// ==========================================

function displayPlayers(players) {
    const tableBody = document.querySelector("#playersTableBody");

    if (players.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="table-empty">
                    No players have been added yet.
                </td>
            </tr>
        `;

        return;
    }

    tableBody.innerHTML = players.map((player) => {

        const joinDate = formatDate(player.join_date);

        const statusClass =
            player.status === "Active"
                ? "status-active"
                : "status-inactive";

        return `
            <tr>

                <!-- PLAYER -->
                <td>
                    <div class="player-name-cell">

                        <div class="player-avatar">
                            ${getPlayerInitials(player.full_name)}
                        </div>

                        <div>
                            <strong>
                                ${escapeHtml(player.full_name)}
                            </strong>

                            ${
                                player.phone
                                    ? `<span>${escapeHtml(player.phone)}</span>`
                                    : ""
                            }

                        </div>

                    </div>
                </td>


                <!-- STUDENT ID -->
                <td>
                    ${
                        player.student_id
                            ? escapeHtml(player.student_id)
                            : "—"
                    }
                </td>


                <!-- POSITION -->
                <td>
                    ${
                        player.position
                            ? escapeHtml(player.position)
                            : "—"
                    }
                </td>


                <!-- JERSEY NUMBER -->
                <td>
                    ${
                        player.jersey_number !== null
                            ? `<span class="jersey-number">
                                ${player.jersey_number}
                            </span>`
                            : "—"
                    }
                </td>


                <!-- JERSEY NAME -->
                <td>
                    ${
                        player.jersey_name
                            ? escapeHtml(player.jersey_name)
                            : "—"
                    }
                </td>


                <!-- JOIN DATE -->
                <td>
                    ${joinDate}
                </td>


                <!-- STATUS -->
                <td>
                    <span class="player-status ${statusClass}">
                        ${escapeHtml(player.status)}
                    </span>
                </td>


                <!-- ACTIONS -->
                <td>

                    <div class="player-actions">

                        <button
                            type="button"
                            class="table-action edit"
                            data-player-id="${player.id}"
                            title="Edit player"
                        >
                            Edit
                        </button>

                        ${
                            player.status === "Active"
                                ? `
                                    <button
                                        type="button"
                                        class="table-action deactivate"
                                        data-player-id="${player.id}"
                                        title="Deactivate player"
                                    >
                                        Deactivate
                                    </button>
                                `
                                : ""
                        }

                    </div>

                </td>

            </tr>
        `;
    }).join("");


    initializePlayerRowButtons();
}


// ==========================================
// PLAYER STATISTICS
// ==========================================

function updatePlayerStatistics(players) {

    const totalPlayers =
        document.querySelector("#totalPlayers");

    const activePlayers =
        document.querySelector("#activePlayers");

    const inactivePlayers =
        document.querySelector("#inactivePlayers");


    const activeCount =
        players.filter(
            (player) => player.status === "Active"
        ).length;


    const inactiveCount =
        players.filter(
            (player) => player.status === "Inactive"
        ).length;


    totalPlayers.textContent = players.length;
    activePlayers.textContent = activeCount;
    inactivePlayers.textContent = inactiveCount;
}


// ==========================================
// MODAL
// ==========================================

function initializePlayerModal() {

    const modal =
        document.querySelector("#playerModal");

    const openButton =
        document.querySelector("#openAddPlayerButton");

    const closeButton =
        document.querySelector("#closePlayerModal");

    const cancelButton =
        document.querySelector("#cancelPlayerButton");


    openButton.addEventListener("click", () => {
        openAddPlayerModal();
    });


    closeButton.addEventListener("click", () => {
        closePlayerModal();
    });


    cancelButton.addEventListener("click", () => {
        closePlayerModal();
    });


    modal.addEventListener("click", (event) => {

        if (event.target === modal) {
            closePlayerModal();
        }

    });
}


// ==========================================
// OPEN ADD PLAYER MODAL
// ==========================================

function openAddPlayerModal() {

    const modal =
        document.querySelector("#playerModal");

    const form =
        document.querySelector("#playerForm");

    const title =
        document.querySelector("#playerModalTitle");

    const playerId =
        document.querySelector("#playerId");

    const statusGroup =
        document.querySelector("#statusGroup");

    const message =
        document.querySelector("#playerFormMessage");


    form.reset();

    playerId.value = "";

    title.textContent = "Add Player";

    statusGroup.style.display = "none";

    message.textContent = "";

    message.className = "form-message";


    setDefaultJoinDate();

    modal.classList.add("show");
}


// ==========================================
// CLOSE MODAL
// ==========================================

function closePlayerModal() {

    const modal =
        document.querySelector("#playerModal");

    modal.classList.remove("show");
}


// ==========================================
// DEFAULT JOIN DATE
// ==========================================

function setDefaultJoinDate() {

    const joinDate =
        document.querySelector("#joinDate");

    const today =
        new Date().toISOString().split("T")[0];

    joinDate.value = today;
}


// ==========================================
// PLAYER FORM
// ==========================================

function initializePlayerForm() {

    const form =
        document.querySelector("#playerForm");


    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        await savePlayer();

    });
}


// ==========================================
// SAVE PLAYER
// ==========================================

async function savePlayer() {

    const playerId =
        document.querySelector("#playerId").value;


    const fullName =
        document.querySelector("#fullName").value.trim();

    const jerseyName =
        document.querySelector("#jerseyName").value.trim();

    const studentId =
        document.querySelector("#studentId").value.trim();

    const phone =
        document.querySelector("#phone").value.trim();

    const position =
        document.querySelector("#position").value;

    const jerseyNumber =
        document.querySelector("#jerseyNumber").value;

    const joinDate =
        document.querySelector("#joinDate").value;

    const status =
        document.querySelector("#playerStatus").value;


    const message =
        document.querySelector("#playerFormMessage");


    if (!fullName) {

        showFormMessage(
            "Please enter the player's full name.",
            "error"
        );

        return;
    }


    if (!joinDate) {

        showFormMessage(
            "Please select the join date.",
            "error"
        );

        return;
    }


    const playerData = {

        full_name: fullName,

        jersey_name:
            jerseyName || null,

        student_id:
            studentId || null,

        phone:
            phone || null,

        position:
            position || null,

        jersey_number:
            jerseyNumber
                ? Number(jerseyNumber)
                : null,

        join_date:
            joinDate,

        status:
            status

    };


    try {

        let response;


        // ----------------------------------
        // ADD PLAYER
        // ----------------------------------

        if (!playerId) {

            response = await fetch(
                "/api/players",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(playerData)
                }
            );

        }


        // ----------------------------------
        // UPDATE PLAYER
        // ----------------------------------

        else {

            response = await fetch(
                `/api/players/${playerId}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(playerData)
                }
            );

        }


        const data =
            await response.json();


        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "Failed to save player."
            );
        }


        // ----------------------------------
        // SUCCESS
        // ----------------------------------

        closePlayerModal();

        await loadPlayers();

        alert(
            playerId
                ? "Player updated successfully."
                : "Player added successfully."
        );


    } catch (error) {

        console.error(
            "Error saving player:",
            error
        );


        showFormMessage(
            error.message ||
            "Failed to save player.",
            "error"
        );

    }
}


// ==========================================
// EDIT / DEACTIVATE BUTTONS
// ==========================================

function initializePlayerRowButtons() {

    const editButtons =
        document.querySelectorAll(
            ".table-action.edit"
        );


    const deactivateButtons =
        document.querySelectorAll(
            ".table-action.deactivate"
        );


    editButtons.forEach((button) => {

        button.addEventListener(
            "click",
            () => {

                const playerId =
                    button.dataset.playerId;

                editPlayer(playerId);

            }
        );

    });


    deactivateButtons.forEach((button) => {

        button.addEventListener(
            "click",
            () => {

                const playerId =
                    button.dataset.playerId;

                deactivatePlayer(playerId);

            }
        );

    });
}


// ==========================================
// EDIT PLAYER
// ==========================================

async function editPlayer(playerId) {

    try {

        const response =
            await fetch(
                `/api/players/${playerId}`
            );


        const data =
            await response.json();


        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "Failed to load player."
            );

        }


        const player =
            data.player;


        document.querySelector("#playerId").value =
            player.id;


        document.querySelector("#fullName").value =
            player.full_name;

        document.querySelector("#jerseyName").value =
            player.jersey_name || "";


        document.querySelector("#studentId").value =
            player.student_id || "";


        document.querySelector("#phone").value =
            player.phone || "";


        document.querySelector("#position").value =
            player.position || "";


        document.querySelector("#jerseyNumber").value =
            player.jersey_number ?? "";


        document.querySelector("#joinDate").value =
            formatDateForInput(player.join_date);


        document.querySelector("#playerStatus").value =
            player.status;


        document.querySelector("#playerModalTitle").textContent =
            "Edit Player";


        document.querySelector("#statusGroup").style.display =
            "block";


        document.querySelector("#playerFormMessage").textContent =
            "";


        document.querySelector("#playerFormMessage").className =
            "form-message";


        document.querySelector("#playerModal")
            .classList.add("show");


    } catch (error) {

        console.error(
            "Error loading player:",
            error
        );

        alert(
            error.message ||
            "Failed to load player."
        );

    }
}


// ==========================================
// DEACTIVATE PLAYER
// ==========================================

async function deactivatePlayer(playerId) {

    const confirmed =
        confirm(
            "Are you sure you want to deactivate this player?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `/api/players/${playerId}/deactivate`,
                {
                    method: "PATCH"
                }
            );


        const data =
            await response.json();


        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "Failed to deactivate player."
            );

        }


        await loadPlayers();


        alert(
            "Player deactivated successfully."
        );


    } catch (error) {

        console.error(
            "Error deactivating player:",
            error
        );


        alert(
            error.message ||
            "Failed to deactivate player."
        );

    }
}


// ==========================================
// SEARCH
// ==========================================

function initializePlayerSearch() {

    const searchInput =
        document.querySelector("#playerSearch");


    searchInput.addEventListener(
        "input",
        () => {

            const searchTerm =
                searchInput.value
                    .trim()
                    .toLowerCase();


            const rows =
                document.querySelectorAll(
                    "#playersTableBody tr"
                );


            rows.forEach((row) => {

                const text =
                    row.textContent.toLowerCase();


                row.style.display =
                    text.includes(searchTerm)
                        ? ""
                        : "none";

            });

        }
    );
}


// ==========================================
// FORM MESSAGE
// ==========================================

function showFormMessage(
    message,
    type
) {

    const element =
        document.querySelector(
            "#playerFormMessage"
        );


    element.textContent = message;

    element.className =
        `form-message ${type}`;
}


// ==========================================
// FORMAT DATE
// ==========================================

function formatDate(dateValue) {

    if (!dateValue) {
        return "—";
    }


    const date =
        new Date(dateValue);


    if (Number.isNaN(date.getTime())) {
        return "—";
    }


    return date.toLocaleDateString(
        "en-US",
        {
            month: "short",
            day: "numeric",
            year: "numeric"
        }
    );
}


// ==========================================
// DATE FOR INPUT
// ==========================================

function formatDateForInput(dateValue) {

    if (!dateValue) {
        return "";
    }


    if (
        typeof dateValue === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ) {
        return dateValue;
    }


    const date =
        new Date(dateValue);


    if (Number.isNaN(date.getTime())) {
        return "";
    }


    return date.toISOString().split("T")[0];
}


// ==========================================
// PLAYER INITIALS
// ==========================================

function getPlayerInitials(name) {

    if (!name) {
        return "P";
    }


    const parts =
        name.trim().split(/\s+/);


    if (parts.length === 1) {
        return parts[0].charAt(0).toUpperCase();
    }


    return (
        parts[0].charAt(0) +
        parts[parts.length - 1].charAt(0)
    ).toUpperCase();
}


// ==========================================
// HTML SAFETY
// ==========================================

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