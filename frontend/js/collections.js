const collectionState = { items: [] };

function collectionUser() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  document.getElementById("userName").textContent =
    user?.name || user?.email?.split("@")[0] || "User";
}

function renderCollections() {
  const query = document
    .getElementById("collectionSearch")
    .value.trim()
    .toLowerCase();
  const items = collectionState.items.filter((item) => {
    const scan = item.scans || item;
    return `${scan.plant_name || ""} ${scan.disease_name || ""}`
      .toLowerCase()
      .includes(query);
  });
  document.getElementById("collectionCount").textContent =
    `${collectionState.items.length} saved`;
  const container = document.getElementById("collectionList");

  if (!items.length) {
    container.innerHTML = `<div class="workspace-empty"><h2>${query ? "No matching saves" : "Your collection is empty"}</h2><p>${query ? "Try a different search term." : "Save useful records from your History page to build a field reference."}</p><a class="btn btn-primary" href="./history.html">Browse history</a></div>`;
    return;
  }

  container.innerHTML = items
    .map((item) => {
      const scan = item.scans || item;
      const title = scan.plant_name || scan.disease_name || "Unnamed sample";
      const image =
        scan.image_url && scan.image_url !== "temp-url"
          ? scan.image_url
          : "./assets/images/default-plant.svg";
      return `<article class="scan-row"><img class="scan-row-image" src="${image}" alt="${title}"><div><h3>${title}</h3><p>${scan.disease_name || "No disease markers recorded"}</p><div class="scan-row-meta"><span>${scan.health_status || "Unknown status"}</span><span>${formatDate(scan.created_at)}</span></div></div><div class="scan-row-actions"><button class="workspace-button workspace-button--danger" data-remove="${item.scan_id}">Remove</button></div></article>`;
    })
    .join("");

  container.querySelectorAll("[data-remove]").forEach((button) =>
    button.addEventListener("click", async () => {
      try {
        const response = await fetch(
          `${API_URL}/collections/${encodeURIComponent(button.dataset.remove)}`,
          { method: "DELETE", headers: getAuthHeaders() },
        );
        const data = await response.json();
        if (!response.ok || !data.success)
          throw new Error(data.message || "Could not remove saved scan.");
        collectionState.items = collectionState.items.filter(
          (item) => item.scan_id !== button.dataset.remove,
        );
        renderCollections();
        showToast("Removed from collections.", "success");
      } catch (error) {
        showToast(error.message || "Could not remove saved scan.", "error");
      }
    }),
  );
}

async function loadCollections() {
  collectionUser();
  if (!localStorage.getItem("token")) {
    window.location.href = "./login.html";
    return;
  }
  try {
    const response = await fetch(`${API_URL}/collections`, {
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (!response.ok || !data.success)
      throw new Error(data.message || "Could not load collections.");
    collectionState.items = Array.isArray(data.data) ? data.data : [];
    renderCollections();
  } catch (error) {
    document.getElementById("collectionList").innerHTML =
      `<div class="workspace-empty"><h2>Collections unavailable</h2><p>${error.message || "Please try again later."}</p></div>`;
    showToast("Could not load collections.", "error");
  }
}

document.documentElement.setAttribute(
  "data-theme",
  localStorage.getItem("theme") || "light",
);
document
  .getElementById("collectionSearch")
  .addEventListener("input", renderCollections);
document
  .getElementById("clearCollection")
  .addEventListener("click", async () => {
    if (
      !collectionState.items.length ||
      !window.confirm("Remove all saved scans?")
    )
      return;
    for (const item of [...collectionState.items]) {
      await fetch(
        `${API_URL}/collections/${encodeURIComponent(item.scan_id)}`,
        { method: "DELETE", headers: getAuthHeaders() },
      );
    }
    collectionState.items = [];
    renderCollections();
    showToast("Collections cleared.", "success");
  });
document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("themeToggle").addEventListener("click", () => {
  const theme =
    document.documentElement.getAttribute("data-theme") === "dark"
      ? "light"
      : "dark";
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
});
loadCollections();
