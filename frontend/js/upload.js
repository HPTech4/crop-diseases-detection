// Client posts to the local proxy at /api/health. The Plant.id API key stays server-side.

const fileInput = document.getElementById("imgUpload");
const uploadedImg = document.getElementById("uploadedImg");
const dropEmpty = document.getElementById("dropEmpty");
const btn = document.getElementById("btn");
const resultsElement = document.getElementById("results");
const dropzone = document.getElementById("dropzone");
const spinner = document.getElementById("spinner");
const readoutStatus = document.getElementById("readoutStatus");

const EMPTY_STATE = `
  <div class="results-empty">
    <p>No sample analyzed yet.</p>
    <p class="muted">Results — species match, health status, and treatment notes — will appear here.</p>
  </div>
`;

function setStatus(text) {
  if (readoutStatus) readoutStatus.textContent = text;
}

function showSpinner(show = true) {
  if (!spinner) return;
  spinner.style.display = show ? "flex" : "none";
  spinner.setAttribute("aria-hidden", show ? "false" : "true");
}

function clearResults() {
  resultsElement.innerHTML = EMPTY_STATE;
}

function setPreview(src) {
  if (!uploadedImg) return;
  uploadedImg.src = src;
  uploadedImg.style.display = "block";
  if (dropEmpty) dropEmpty.style.display = "none";
}

fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
    btn.disabled = false;
    clearResults();
    setStatus("Ready to analyze");
  } else {
    uploadedImg.style.display = "none";
    if (dropEmpty) dropEmpty.style.display = "flex";
    btn.disabled = true;
    setStatus("Awaiting sample");
  }
});

// drag & drop support
if (dropzone) {
  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add("dragover");
    }),
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove("dragover");
    }),
  );
  dropzone.addEventListener("drop", (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length) {
      fileInput.files = files;
      fileInput.dispatchEvent(new Event("change"));
    }
  });
}

btn.addEventListener("click", async () => {
  if (!fileInput.files[0]) {
    if (typeof showToast === "function") {
      showToast("Please upload an image first.", "error");
    } else {
      alert("Please upload an image first.");
    }
    return;
  }

  const formData = new FormData();
  formData.append("images", fileInput.files[0]);
  formData.append("health", "true");

  const PROXY_ORIGIN = "https://crop-care-be.vercel.app";
  let proxyPath;
  if (
    window.location.origin === PROXY_ORIGIN ||
    window.location.port === "3000"
  ) {
    proxyPath = "/api/health"; // same origin - use relative path
  } else {
    // opened via file:// or a different dev origin (eg Live Server) - use absolute proxy
    proxyPath = PROXY_ORIGIN + "/api/health";
  }

  resultsElement.innerHTML = "";
  showSpinner(true);
  setStatus("Analyzing…");
  btn.disabled = true;

  try {
    const response = await fetch(proxyPath, {
      method: "POST",
      body: formData,
    });

    const text = await response.text();

    if (!response.ok) {
      resultsElement.innerHTML = `<div class="result-card"><p><strong>Error</strong>Server returned ${response.status} ${response.statusText}. Check the console for details.</p></div>`;
      setStatus("Error");
      return;
    }

    let data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      resultsElement.innerHTML = `<div class="result-card"><pre>${text}</pre></div>`;
      setStatus("Error");
      return;
    }

    displayResult(data);
  } catch (error) {
    console.error("Error during fetch to proxy:", error);
    resultsElement.innerHTML = `<div class="result-card"><p><strong>Error</strong>Couldn't reach the analysis service. Please try again.</p></div>`;
    setStatus("Error");
  } finally {
    showSpinner(false);
    btn.disabled = false;
  }
});

function displayResult(data) {
  const isPlant = data?.result?.is_plant;
  const isHealthy = data?.result?.is_healthy;
  const diseases = data?.result?.disease?.suggestions || [];

  if (!isPlant?.binary) {
    resultsElement.innerHTML = `<div class="result-card"><p><strong>Not a plant</strong>The uploaded image doesn't appear to show a plant. Try a clearer, closer photo of a single leaf.</p></div>`;
    setStatus("No plant detected");
    return;
  }

  if (isHealthy?.binary) {
    resultsElement.innerHTML = `
      <div class="result-card healthy">
        <h2>Sample healthy</h2>
        <p><strong>Result</strong>No disease markers detected.</p>
        <p><strong>Confidence</strong>${(isHealthy.probability * 100).toFixed(2)}%</p>
      </div>
    `;
    setStatus("Healthy");
    return;
  }

  if (diseases.length > 0) {
    let html = `
      <h2>Disease markers detected</h2>
      <p class="muted" style="margin-bottom:12px;">Top matches, ranked by confidence:</p>
    `;

    diseases.slice(0, 3).forEach((d, i) => {
      const name = d.name || "Unknown disease";
      const probability = d.probability
        ? (d.probability * 100).toFixed(2) + "%"
        : "N/A";

      const description =
        d.details?.wiki_description?.value ||
        d.details?.description ||
        d.details?.common_names?.join(", ") ||
        "Limited reference information available for this match.";

      const wikiUrl = d.details?.wiki_url
        ? `<a href="${d.details.wiki_url}" target="_blank" rel="noopener">Reference →</a>`
        : "";

      const treatment =
        d.treatment?.biological ||
        d.treatment?.chemical ||
        d.treatment?.prevention ||
        "Remove affected foliage, sanitize tools between plants, and improve airflow around the canopy.";

      const confValue = parseFloat(d.probability * 100).toFixed(1);
      const confColor =
        confValue >= 80 ? "#B5502E" : confValue >= 50 ? "#C99A34" : "#2F5233";

      html += `
        <div class="disease-card">
          <h3>${i + 1}. ${name}</h3>
          <div class="confidence-bar" style="background:${confColor}; width:${confValue}%; height:5px; margin:8px 0 10px;"></div>
          <p><strong>Confidence</strong>${probability}</p>
          <p><strong>Details</strong>${description} ${wikiUrl}</p>
          <p><strong>Treatment</strong>${treatment}</p>
        </div>
      `;
    });

    resultsElement.innerHTML = html;
    setStatus(
      `${diseases.length} match${diseases.length > 1 ? "es" : ""} found`,
    );
  } else {
    resultsElement.innerHTML = `
      <div class="result-card">
        <h2>No confident match</h2>
        <p>A plant was detected, but no disease could be matched with confidence.</p>
        <p class="muted">Try a clearer photo of the affected leaf, or a different angle.</p>
      </div>
    `;
    setStatus("Inconclusive");
  }
}
