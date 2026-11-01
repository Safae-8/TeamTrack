// =========================================
// TEAMTRACK SETTINGS
// =========================================

document.addEventListener("DOMContentLoaded", () => {
    const API_URL = "http://localhost:3000/api/settings";

    const generalForm = document.getElementById("generalSettingsForm");
    const attendanceForm = document.getElementById("attendanceSettingsForm");

    const generalMessage = document.getElementById("generalSettingsMessage");
    const attendanceMessage = document.getElementById("attendanceSettingsMessage");

    const fields = {
        teamName: document.getElementById("teamName"),
        academicYear: document.getElementById("academicYear"),
        lateThreshold: document.getElementById("lateThreshold"),
        finePerLate: document.getElementById("finePerLate"),
        monthlyAbsenceThreshold:
            document.getElementById("monthlyAbsenceThreshold")
    };

    let savedSettings = null;

    function showMessage(element, message, type = "error") {
        element.textContent = message;
        element.className = `form-message ${type}`;
    }

    async function requestSettings(method = "GET", body = null) {
        const options = { method, headers: {} };

        if (body !== null) {
            options.headers["Content-Type"] = "application/json";
            options.body = JSON.stringify(body);
        }

        const response = await fetch(API_URL, options);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Settings request failed.");
        }

        return result.settings;
    }

    function displaySettings(settings) {
        fields.teamName.value = settings.team_name ?? "";
        fields.academicYear.value = settings.academic_year ?? "";
        fields.lateThreshold.value = settings.late_threshold ?? 3;
        fields.finePerLate.value = settings.fine_per_late ?? 10;
        fields.monthlyAbsenceThreshold.value =
            settings.monthly_absence_threshold ?? 3;
    }

    function getFormSettings() {
        const lateThreshold = Number(fields.lateThreshold.value);
        const finePerLate = Number(fields.finePerLate.value);
        const monthlyAbsenceThreshold =
            Number(fields.monthlyAbsenceThreshold.value);

        if (
            !Number.isInteger(lateThreshold) ||
            lateThreshold < 1 ||
            !Number.isFinite(finePerLate) ||
            finePerLate < 0 ||
            !Number.isInteger(monthlyAbsenceThreshold) ||
            monthlyAbsenceThreshold < 1
        ) {
            throw new Error("Enter valid numbers for all attendance rules.");
        }

        return {
            team_name: fields.teamName.value.trim(),
            academic_year: fields.academicYear.value.trim(),
            late_threshold: lateThreshold,
            fine_per_late: finePerLate,
            monthly_absence_threshold: monthlyAbsenceThreshold
        };
    }

    async function loadSettings() {
        try {
            savedSettings = await requestSettings();
            displaySettings(savedSettings);
        } catch (error) {
            console.error("Could not load settings:", error);
            showMessage(
                generalMessage,
                `Could not load settings: ${error.message}`,
                "error"
            );
            showMessage(
                attendanceMessage,
                "Settings could not be loaded. Please check the backend.",
                "error"
            );
        }
    }

    
    generalForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!savedSettings) {
            showMessage(
                generalMessage,
                "Settings are not loaded yet. Please refresh the page.",
                "error"
            );
            return;
        }

        try {
            const payload = {
                team_name: fields.teamName.value.trim(),
                academic_year: fields.academicYear.value.trim(),
                late_threshold: Number(savedSettings.late_threshold),
                fine_per_late: Number(savedSettings.fine_per_late),
                monthly_absence_threshold:
                    Number(savedSettings.monthly_absence_threshold)
            };

            if (!payload.team_name) {
                throw new Error("Please enter a team name.");
            }

            if (!payload.academic_year) {
                throw new Error("Please enter the academic year.");
            }

            savedSettings = await requestSettings("PUT", payload);
            displaySettings(savedSettings);

            showMessage(
                generalMessage,
                "General settings saved successfully.",
                "success"
            );

        } catch (error) {
            console.error("Error saving general settings:", error);

            showMessage(
                generalMessage,
                error.message || "Failed to save general settings.",
                "error"
            );
        }
    });


    attendanceForm.addEventListener("submit", async (event) => {
        if (!attendanceForm.reportValidity()) return;

        event.preventDefault();

        if (!savedSettings) {
            showMessage(attendanceMessage, "Settings are not loaded yet.");
            return;
        }

        try {
            const payload = getFormSettings();

            payload.team_name = savedSettings.team_name;
            payload.academic_year = savedSettings.academic_year;

            savedSettings = await requestSettings("PUT", payload);
            displaySettings(savedSettings);

            showMessage(
                attendanceMessage,
                "Attendance rules saved successfully.",
                "success"
            );
        } catch (error) {
            showMessage(attendanceMessage, error.message, "error");
        }
    });

    loadSettings();
});
