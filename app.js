const $ = id => document.getElementById(id);

let apps = [];
let sources = JSON.parse(localStorage.getItem("elux_sources") || "[]");
let savedApps = JSON.parse(localStorage.getItem("elux_saved") || "[]");
let currentPage = "discover";
let toastTimer;

function save() {
  localStorage.setItem("elux_sources", JSON.stringify(sources));
  localStorage.setItem("elux_saved", JSON.stringify(savedApps));
}

function notify(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

function safeText(value) {
  return String(value ?? "");
}

function showPage(page) {
  currentPage = page;
  document.querySelectorAll(".page").forEach(el => el.hidden = true);
  $(page).hidden = false;

  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.page === page);
  });

  if (page === "discover") renderApps();
  if (page === "myapps") renderMyApps();
  if (page === "sources") renderSources();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function normalizeCatalog(data, sourceName) {
  if (!data || !Array.isArray(data.apps)) {
    throw new Error("This JSON does not contain an apps array.");
  }

  return data.apps.map(app => ({
    name: safeText(app.name || app.title || "Unnamed app"),
    bundleIdentifier: safeText(app.bundleIdentifier || app.bundleId || ""),
    developer: safeText(app.developerName || app.developer || "Unknown developer"),
    description: safeText(app.localizedDescription || app.subtitle || app.description || "No description provided."),
    icon: safeText(app.iconURL || app.icon || ""),
    source: sourceName,
    versions: Array.isArray(app.versions) ? app.versions : []
  }));
}

async function loadSource(source) {
  try {
    const response = await fetch(source.url);
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    const found = normalizeCatalog(data, source.name);
    apps.push(...found);
    source.status = "Connected";
    source.appCount = found.length;
    save();
    return true;
  } catch (error) {
    source.status = "Failed to load";
    source.error = error.message;
    save();
    console.warn("Elux source error:", source.url, error);
    return false;
  }
}

async function reloadSources() {
  apps = [];
  for (const source of sources) {
    if (source.type === "url") await loadSource(source);
    if (source.type === "file" && source.catalog) {
      try {
        apps.push(...normalizeCatalog(source.catalog, source.name));
        source.status = "Imported";
        source.appCount = source.catalog.apps.length;
      } catch (error) {
        source.status = "Invalid JSON";
      }
    }
  }
  renderApps();
  renderSources();
}

function appIcon(app, sizeClass = "app-icon") {
  if (app.icon) {
    return `<img class="${sizeClass}" src="${escapeAttr(app.icon)}" alt="" onerror="this.style.display='none'">`;
  }
  return `<div class="${sizeClass} fallback">✦</div>`;
}

function escapeHTML(value) {
  return safeText(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function escapeAttr(value) {
  return escapeHTML(value);
}

function renderApps() {
  const query = $("search").value.trim().toLowerCase();
  const filtered = apps.filter(app =>
    app.name.toLowerCase().includes(query) ||
    app.developer.toLowerCase().includes(query) ||
    app.description.toLowerCase().includes(query)
  );

  $("appCount").textContent = `${filtered.length} apps`;
  $("emptyDiscover").hidden = filtered.length !== 0;

  $("appGrid").innerHTML = filtered.map(app => {
    const index = apps.indexOf(app);
    const version = app.versions[0]?.version || "Unknown version";

    return `
      <article class="app-card" onclick="showDetails(${index})">
        <div class="app-top">
          ${appIcon(app)}
          <div>
            <h3>${escapeHTML(app.name)}</h3>
            <div class="developer">${escapeHTML(app.developer)}</div>
          </div>
        </div>
        <p class="app-description">${escapeHTML(app.description.slice(0, 105))}</p>
        <div class="card-bottom">
          <span>${escapeHTML(version)}</span>
          <span>VIEW APP →</span>
        </div>
      </article>`;
  }).join("");
}

function showDetails(index) {
  const app = apps[index];
  if (!app) return;

  const versions = app.versions.map(version => {
    const url = safeText(version.downloadURL || version.downloadUrl || "");
    const validUrl = safeDownloadURL(url);

    return `
      <div class="version">
        <strong>Version ${escapeHTML(version.version || "Unknown")}</strong>
        <small>
          ${escapeHTML(version.date || "Date not provided")}
          ${version.size ? " · " + escapeHTML(version.size) : ""}
          ${version.minOSVersion ? " · iOS " + escapeHTML(version.minOSVersion) + "+" : ""}
        </small>
        ${validUrl ? `<p><a class="primary" href="${escapeAttr(validUrl)}" target="_blank" rel="noopener">Download IPA ↗</a></p>` : `<p class="hint">No valid download link provided.</p>`}
      </div>`;
  }).join("");

  $("detailContent").innerHTML = `
    <div class="detail-hero">
      <div class="app-top">
        ${appIcon(app)}
        <div>
          <h2>${escapeHTML(app.name)}</h2>
          <div class="developer">${escapeHTML(app.developer)}</div>
        </div>
      </div>
    </div>
    <div class="panel">
      <div class="eyebrow">ABOUT THIS APP</div>
      <p class="detail-description">${escapeHTML(app.description)}</p>
      <div class="setting-row"><span>Bundle ID</span><strong>${escapeHTML(app.bundleIdentifier || "Not provided")}</strong></div>
      <div class="setting-row"><span>Repository</span><strong>${escapeHTML(app.source)}</strong></div>
    </div>
    <div class="panel">
      <h3>Available versions</h3>
      ${versions || "<p>No version downloads were listed in this catalog.</p>"}
    </div>
    <p class="hint">Downloading an IPA does not install or sign it. Only download files from sources you trust.</p>
  `;

  document.querySelectorAll(".page").forEach(el => el.hidden = true);
  $("details").hidden = false;
  currentPage = "details";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function safeDownloadURL(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

$("search").addEventListener("input", renderApps);

$("addSource").addEventListener("click", async () => {
  const url = $("sourceUrl").value.trim();
  const name = $("sourceName").value.trim() || "Custom repository";

  if (!safeDownloadURL(url)) {
    notify("Enter a valid HTTP or HTTPS URL.");
    return;
  }

  if (sources.some(source => source.url === url)) {
    notify("That repository is already added.");
    return;
  }

  const source = { name, url, type: "url", status: "Loading..." };
  sources.push(source);
  save();
  $("sourceUrl").value = "";
  $("sourceName").value = "";

  notify("Loading repository...");
  const success = await loadSource(source);

  if (success) {
    notify(`Repository added: ${source.appCount} apps found.`);
  } else {
    notify("Couldn't load it. Try importing its JSON file.");
  }

  renderApps();
  renderSources();
});

$("jsonInput").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const catalog = JSON.parse(await file.text());
    normalizeCatalog(catalog, file.name);

    sources.push({
      name: file.name,
      type: "file",
      catalog,
      status: "Imported"
    });

    save();
    await reloadSources();
    notify("Repository JSON imported!");
  } catch (error) {
    notify("Import failed: " + error.message);
  }

  event.target.value = "";
});

function renderSources() {
  $("sourceList").innerHTML = sources.map((source, index) => `
    <div class="app-row">
      <div>
        <strong>${escapeHTML(source.name)}</strong>
        <small>${escapeHTML(source.status || "Saved")} · ${source.appCount || 0} apps</small>
        ${source.error ? `<small>${escapeHTML(source.error)}</small>` : ""}
      </div>
      <button class="small-button" onclick="removeSource(${index})">Remove</button>
    </div>
  `).join("") || `<div class="empty"><p>No repositories added yet.</p></div>`;
}

function removeSource(index) {
  sources.splice(index, 1);
  save();
  reloadSources();
  notify("Repository removed.");
}

const DB_NAME = "EluxLocalFiles";
let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("ipas", { keyPath: "id", autoIncrement: true });
    };
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

function dbRequest(mode, action) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("ipas", mode);
    const request = action(transaction.objectStore("ipas"));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

$("ipaInput").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.name.toLowerCase().endsWith(".ipa")) {
    notify("Please select an IPA file.");
    return;
  }

  try {
    await dbRequest("readwrite", store => store.add({
      name: file.name,
      size: file.size,
      date: new Date().toISOString(),
      blob: file
    }));

    notify("IPA saved to your collection!");
    renderMyApps();
  } catch (error) {
    notify("Couldn't save file. Device storage may be full.");
  }

  event.target.value = "";
});

async function renderMyApps() {
  const files = await dbRequest("readonly", store => store.getAll());
  $("myCount").textContent = `${files.length} files`;
  $("emptyMy").hidden = files.length > 0;

  $("myAppList").innerHTML = files.map(file => `
    <div class="app-row">
      <div>
        <strong>${escapeHTML(file.name)}</strong>
        <small>${formatSize(file.size)} · Saved locally</small>
      </div>
      <button class="small-button" onclick="downloadSaved(${file.id})">Export</button>
      <button class="small-button" onclick="deleteSaved(${file.id})">Delete</button>
    </div>
  `).join("");
}

async function downloadSaved(id) {
  const file = await dbRequest("readonly", store => store.get(id));
  if (!file) return;

  const url = URL.createObjectURL(file.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function deleteSaved(id) {
  await dbRequest("readwrite", store => store.delete(id));
  renderMyApps();
  notify("IPA deleted.");
}

function formatSize(bytes) {
  if (!bytes) return "Unknown size";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size.toFixed(1)} ${units[unit]}`;
}

$("clearData").addEventListener("click", async () => {
  if (!confirm("Delete all Elux repositories, saved app data, and imported IPA files?")) return;

  localStorage.removeItem("elux_sources");
  localStorage.removeItem("elux_saved");
  sources = [];
  savedApps = [];
  apps = [];

  await dbRequest("readwrite", store => store.clear());
  await reloadSources();
  renderMyApps();
  notify("Elux data cleared.");
  showPage("discover");
});

async function start() {
  try {
    await openDB();
    await reloadSources();
    renderMyApps();
  } catch (error) {
    notify("Local file storage is unavailable in this browser.");
  }

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
  }
}

start();
