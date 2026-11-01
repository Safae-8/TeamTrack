
async function loadComponent(elementId, filePath) {
    const element = document.getElementById(elementId);

    if (!element) {
        return;
    }

    try {
        const response = await fetch(filePath);

        if (!response.ok) {
            throw new Error(`Failed to load ${filePath}`);
        }

        element.innerHTML = await response.text();

    } catch (error) {
        console.error(`Error loading component ${filePath}:`, error);
    }
}


function initializeActiveSidebarLink() {
    const navItems = document.querySelectorAll(".sidebar-nav .nav-item");

    if (!navItems.length) {
        return;
    }

    const currentPage = (
        window.location.pathname.split("/").pop() || "index.html"
    ).toLowerCase();

    navItems.forEach((item) => {
        const href = (item.getAttribute("href") || "").toLowerCase();
        const targetPage = href.split("/").pop();

        const isActive =
            targetPage === currentPage &&
            href !== "#" &&
            href !== "";

        item.classList.toggle("active", isActive);
    });
}


document.addEventListener("DOMContentLoaded", async () => {
    await Promise.all([
        loadComponent("sidebar-container", "components/sidebar.html"),
        loadComponent("topbar-container", "components/topbar.html")
    ]);

    // Restore the selected page after the sidebar is injected.
    initializeActiveSidebarLink();

    // Notify other scripts that shared components are ready.
    document.dispatchEvent(new Event("componentsLoaded"));
});

