const historyState = { scans: [], filtered: [], page: 1, pageSize: 8 };

function historyUser() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const name = user?.name || user?.email?.split("@")[0] || "User";
  const userName = document.getElementById("userName");
  if (userName) userName.textContent = name;
}

function scanStatus(scan) {
  return scan.health_status === "healthy" ? "healthy" : "diseased";
}

async function saveScan(scan) {
  try {
    const response = await fetch(`${API_URL}/collections`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ scan_id: scan.id }),
    });
    const data = await response.json();
    if (!response.ok || !data.success)
      throw new Error(data.message || "Could not save scan.");
    showToast("Scan saved to collections.", "success");
  } catch (error) {
    showToast(error.message || "Could not save scan.", "error");
  }
}

function renderHistory() {
  const container = document.getElementById("historyList");
  const totalPages = Math.max(
    1,
    Math.ceil(historyState.filtered.length / historyState.pageSize),
  );
  historyState.page = Math.min(historyState.page, totalPages);
  const start = (historyState.page - 1) * historyState.pageSize;
  const scans = historyState.filtered.slice(
    start,
    start + historyState.pageSize,
  );

  document.getElementById("scanCount").textContent =
    `${historyState.filtered.length} shown`;
  document.getElementById("totalCount").textContent = historyState.scans.length;
  document.getElementById("healthyCount").textContent =
    historyState.scans.filter((scan) => scanStatus(scan) === "healthy").length;
  document.getElementById("diseasedCount").textContent =
    historyState.scans.filter((scan) => scanStatus(scan) === "diseased").length;

  if (!scans.length) {
    container.innerHTML =
      '<div class="workspace-empty"><h2>No matching scans</h2><p>Your scan history will appear here after a diagnosis.</p><a class="btn btn-primary" href="./upload.html">Start a scan</a></div>';
    document.getElementById("pagination").innerHTML = "";
    return;
  }

  container.innerHTML = scans
    .map((scan) => {
      const status = scanStatus(scan);
      const title = scan.plant_name || scan.disease_name || "Unnamed sample";
      const detail =
        scan.disease_name ||
        (status === "healthy" ? "No disease markers recorded" : "Needs review");
      const image =
        scan.image_url && scan.image_url !== "temp-url"
          ? scan.image_url
          : "./assets/images/default-plant.svg";
      return `<article class="scan-row"><img class="scan-row-image" src="${image}" alt="${title}"><div><h3>${title}</h3><p>${detail}</p><div class="scan-row-meta"><span class="status ${status}">${status}</span><span>${formatDate(scan.created_at)}</span></div></div><div class="scan-row-actions"><button class="workspace-button" data-save="${scan.id}">Save</button><button class="workspace-button workspace-button--danger" data-delete="${scan.id}">Delete</button></div></article>`;
    })
    .join("");

  container.querySelectorAll("[data-save]").forEach((button) =>
    button.addEventListener("click", () => {
      const scan = historyState.scans.find(
        (item) => item.id === button.dataset.save,
      );
      if (scan) saveScan(scan);
    }),
  );
  container
    .querySelectorAll("[data-delete]")
    .forEach((button) =>
      button.addEventListener("click", () => deleteScan(button.dataset.delete)),
    );

  const pagination = document.getElementById("pagination");
  pagination.innerHTML =
    totalPages > 1
      ? `<button class="workspace-button" id="previousPage" ${historyState.page === 1 ? "disabled" : ""}>Previous</button><span class="workspace-muted">Page ${historyState.page} of ${totalPages}</span><button class="workspace-button" id="nextPage" ${historyState.page === totalPages ? "disabled" : ""}>Next</button>`
      : "";
  document.getElementById("previousPage")?.addEventListener("click", () => {
    historyState.page -= 1;
    renderHistory();
  });
  document.getElementById("nextPage")?.addEventListener("click", () => {
    historyState.page += 1;
    renderHistory();
  });
}

function applyFilters() {
  const query = document
    .getElementById("scanSearch")
    .value.trim()
    .toLowerCase();
  const status = document.getElementById("statusFilter").value;
  historyState.filtered = historyState.scans.filter((scan) => {
    const haystack =
      `${scan.plant_name || ""} ${scan.disease_name || ""} ${scan.health_status || ""}`.toLowerCase();
    return (
      (!query || haystack.includes(query)) &&
      (status === "all" || scanStatus(scan) === status)
    );
  });
  historyState.page = 1;
  renderHistory();
}

async function deleteScan(id) {
  if (!window.confirm("Delete this scan from your history?")) return;
  try {
    const response = await fetch(`${API_URL}/scans/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (!response.ok || !data.success)
      throw new Error(data.message || "Delete failed");
    historyState.scans = historyState.scans.filter((scan) => scan.id !== id);
    applyFilters();
    showToast("Scan deleted.", "success");
  } catch (error) {
    showToast(error.message || "Could not delete scan.", "error");
  }
}

async function loadHistory() {
  historyUser();
  if (!localStorage.getItem("token")) {
    window.location.href = "./login.html";
    return;
  }
  try {
    const response = await fetch(`${API_URL}/scans?limit=100`, {
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (!response.ok || !data.success)
      throw new Error(data.message || "Could not load scan history.");
    historyState.scans = Array.isArray(data.data) ? data.data : [];
    historyState.filtered = historyState.scans;
    renderHistory();
  } catch (error) {
    document.getElementById("historyList").innerHTML =
      `<div class="workspace-empty"><h2>History unavailable</h2><p>${error.message || "Please try again later."}</p><a class="btn btn-primary" href="./upload.html">New scan</a></div>`;
    showToast("Could not load scan history.", "error");
  }
}

document.getElementById("scanSearch").addEventListener("input", applyFilters);
document
  .getElementById("statusFilter")
  .addEventListener("change", applyFilters);
document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("themeToggle").addEventListener("click", () => {
  const theme =
    document.documentElement.getAttribute("data-theme") === "dark"
      ? "light"
      : "dark";
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
});
document.documentElement.setAttribute(
  "data-theme",
  localStorage.getItem("theme") || "light",
);
loadHistory();
