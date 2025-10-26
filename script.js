// Client will POST to the local proxy at /api/health. Do NOT store API keys in client-side code.

const fileInput = document.getElementById("imgUpload");
const uploadedImg = document.getElementById("uploadedImg");
const btn = document.getElementById("btn");
const resultsElement = document.getElementById("results");
const dropzone = document.getElementById("dropzone");
const spinner = document.getElementById("spinner");

function showSpinner(show = true) {
  if (!spinner) return;
  spinner.style.display = show ? "block" : "none";
  spinner.setAttribute("aria-hidden", show ? "false" : "true");
}

function clearResults() {
  resultsElement.innerHTML = "";
}

function setPreview(src) {
  if (!uploadedImg) return;
  uploadedImg.src = src;
  uploadedImg.style.display = "block";
}

fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(file);
    btn.disabled = false;
    clearResults();
  } else {
    uploadedImg.style.display = "none";
    btn.disabled = true;
  }
});

// drag & drop support
if (dropzone) {
  ['dragenter','dragover'].forEach(evt => dropzone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dropzone.classList.add('dragover'); }));
  ['dragleave','drop'].forEach(evt => dropzone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dropzone.classList.remove('dragover'); }));
  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length) {
      fileInput.files = files;
      const evt = new Event('change');
      fileInput.dispatchEvent(evt);
    }
  });
}

btn.addEventListener("click", async () => {
  if (!fileInput.files[0]) {
    alert("Please upload an image first.");
    return;
  }

  const formData = new FormData();
  formData.append("images", fileInput.files[0]);
  formData.append("health", "true");

  // debug logs to help trace where fetch is going and what is being sent
  console.log('[client] Uploading file:', fileInput.files[0].name, '-', fileInput.files[0].size, 'bytes');
  console.log('[client] window.location.origin:', window.location.origin);
  // Choose proxy URL dynamically so client works whether served from the proxy (3000) or another host (eg Live Server on 5500)
  const PROXY_ORIGIN = 'http://localhost:3000';
  let proxyPath;
  if (window.location.origin === PROXY_ORIGIN || window.location.port === '3000') {
    proxyPath = '/api/health'; // same origin - use relative path
  } else if (window.location.protocol === 'file:') {
    // opened from file:// - use absolute proxy
    proxyPath = PROXY_ORIGIN + '/api/health';
  } else {
    // different origin (eg Live Server on 5500) - use absolute proxy
    proxyPath = PROXY_ORIGIN + '/api/health';
  }
  console.log('[client] POST target (proxyPath):', proxyPath);
  try { console.log('[client] resolved absolute target:', new URL(proxyPath, window.location.origin).href); } catch(e){}

  clearResults();
  showSpinner(true);
  btn.disabled = true;

  try {
    // POST to our proxy which keeps the API key server-side
    const response = await fetch(proxyPath, {
      method: 'POST',
      body: formData,
    });

    const text = await response.text();
    console.log('[client] fetch response status:', response.status, 'text-snippet:', text && text.slice(0, 400));

    if (!response.ok) {
      // show upstream body when available to help debugging (405 details)
      console.error('[client] non-ok response from proxy:', response.status, text);
      resultsElement.innerHTML = `<div class="result-card"><p>Server error: ${response.status} ${response.statusText}. See console for details.</p></div>`;
      return;
    }

    let data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.warn('[client] failed to parse JSON from proxy, raw text returned');
      resultsElement.innerHTML = `<div class="result-card"><pre>${text}</pre></div>`;
      return;
    }

    console.log('Full API Response (via proxy):', data);
    displayResult(data);
  } catch (error) {
    console.error('Error during fetch to proxy:', error);
    resultsElement.innerHTML = `<div class="result-card"><p>Failed to analyze the image. Please try again later.</p></div>`;
  } finally {
    showSpinner(false);
    btn.disabled = false;
  }
});

function displayResult(data) {
  const resultElement = document.getElementById("results");
  const isPlant = data?.result?.is_plant;
  const isHealthy = data?.result?.is_healthy;
  const diseases = data?.result?.disease?.suggestions || [];

  if (!isPlant?.binary) {
    resultElement.innerHTML = `<div class="result-card"><p>❌ The uploaded image doesn’t appear to be a plant.</p></div>`;
    return;
  }

  if (isHealthy?.binary) {
    resultElement.innerHTML = `
      <div class="result-card healthy">
        <h2>✅ Plant Health Status</h2>
        <p><strong>Result:</strong> The plant looks healthy!</p>
        <p><strong>Confidence:</strong> ${(isHealthy.probability * 100).toFixed(2)}%</p>
      </div>
    `;
    return;
  }

  if (diseases.length > 0) {
    let html = `
      <h2>⚠️ Disease(s) Detected</h2>
      <p>Below are the top detected diseases and their details:</p>
    `;

    diseases.slice(0, 3).forEach((d, i) => {
      const name = d.name || "Unknown Disease";
      const probability = d.probability ? (d.probability * 100).toFixed(2) + "%" : "N/A";

      // Extract details safely
      let description =
        d.details?.wiki_description?.value ||
        d.details?.description ||
        d.details?.common_names?.join(", ") ||
        "This plant disease has limited information in the dataset.";

      let wikiUrl = d.details?.wiki_url
        ? `<a href="${d.details.wiki_url}" target="_blank">Learn more →</a>`
        : "";

      const treatment =
        d.treatment?.biological ||
        d.treatment?.chemical ||
        d.treatment?.prevention ||
        "Try removing infected parts, using clean tools, and improving airflow.";

      // Confidence as color bar 🌈
      const confValue = parseFloat(d.probability * 100).toFixed(1);
      const confColor =
        confValue >= 80 ? "#d9534f" : confValue >= 50 ? "#f0ad4e" : "#5bc0de";

      html += `
        <div class="disease-card">
          <h3>🩸 ${i + 1}. ${name}</h3>
          <div class="confidence-bar" style="background: ${confColor}; width: ${confValue}%; height: 6px; border-radius: 3px; margin: 6px 0;"></div>
          <p><strong>Confidence:</strong> ${probability}</p>
          <p><strong>Details:</strong> ${description} ${wikiUrl}</p>
          <p><strong>Treatment:</strong> ${treatment}</p>
        </div>
      `;
    });

    resultElement.innerHTML = html;
  } else {
    resultElement.innerHTML = `
      <div class="result-card">
        <h2>😕 No Clear Disease Identified</h2>
        <p>The system detected a plant but couldn’t match a known disease confidently.</p>
        <p>Try a clearer photo of the affected leaf or a different angle.</p>
      </div>
    `;
  }
}
