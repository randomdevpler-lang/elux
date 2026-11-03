
const $ = id => document.getElementById(id);

let apps = [];
let sources = JSON.parse(localStorage.getItem("elux_sources") || "[]");
let db = null;
let selectedIPA = null;
let toastTimer;

function saveSources() {
  localStorage.setItem("elux_sources",JSON.stringify(sources));
}

function notify(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"),2800);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g,char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",
    '"':"&quot;","'":"&#39;"
  })[char]);
}

function safeURL(value) {
  try {
    const url = new URL(value);
    return ["https:","http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function showPage(page) {
  document.querySelectorAll(".page").forEach(el => el.hidden = true);
  $(page).hidden = false;

  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active",tab.dataset.page === page);
  });

  if (page === "discover") renderApps();
  if (page === "myapps") renderMyApps();
  if (page === "sources") renderSources();
  if (page === "installprep") renderInstallPrep();

  window.scrollTo({top:0,behavior:"smooth"});
}

function normalizeCatalog(data,sourceName) {
  if (!data || !Array.isArray(data.apps)) {
    throw new Error("This JSON does not contain an apps array.");
  }

  return data.apps.map(app => ({
    name:String(app.name || app.title || "Unnamed app"),
    bundleIdentifier:String(app.bundleIdentifier || app.bundleId || ""),
    developer:String(app.developerName || app.developer || "Unknown developer"),
    description:String(app.localizedDescription || app.subtitle || app.description || "No description provided."),
    icon:safeURL(app.iconURL || app.icon || ""),
    source:sourceName,
    versions:Array.isArray(app.versions) ? app.versions : []
  }));
}

async function loadSource(source) {
  try {
    const response = await fetch(source.url);
    if (!response.ok) throw new Error("HTTP " + response.status);

    const data = await response.json();
    const loaded = normalizeCatalog(data,source.name);

    apps.push(...loaded);
    source.status = "Connected";
    source.appCount = loaded.length;
    delete source.error;

    return true;
  } catch (error) {
    source.status = "Failed to load";
    source.error = error.message;
    return false;
  }
}

async function reloadSources() {
  apps = [];

  for (const source of sources) {
    if (source.type === "url") {
      await loadSource(source);
    } else if (source.type === "file" && source.catalog) {
      try {
        const loaded = normalizeCatalog(source.catalog,source.name);
        apps.push(...loaded);
        source.status = "Imported";
        source.appCount = loaded.length;
      } catch (error) {
        source.status = "Invalid JSON";
        source.error = error.message;
      }
    }
  }

  saveSources();
  renderApps();
  renderSources();
}

function appIcon(app) {
  return app.icon
    ? `<img class="app-icon" src="${escapeHTML(app.icon)}" alt="" onerror="this.style.display='none'">`
    : `<div class="app-icon fallback">✦</div>`;
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
        <p class="app-description">${escapeHTML(app.description.slice(0,105))}</p>
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
    const url = safeURL(version.downloadURL || version.downloadUrl || "");

    return `
      <div class="version">
        <strong>Version ${escapeHTML(version.version || "Unknown")}</strong>
        <small>${escapeHTML(version.date || "Date not provided")}</small>
        ${
          url
          ? `<p><a class="primary" href="${escapeHTML(url)}" target="_blank" rel="noopener">↓ Download IPA</a></p>`
          : `<p class="hint">No valid download link provided.</p>`
        }
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
      <div class="setting-row">
        <span>Bundle ID</span>
        <strong>${escapeHTML(app.bundleIdentifier || "Not provided")}</strong>
      </div>
      <div class="setting-row">
        <span>Repository</span>
        <strong>${escapeHTML(app.source)}</strong>
      </div>
    </div>

    <div class="panel">
      <h3>Available versions</h3>
      ${versions || "<p>No versions listed.</p>"}
    </div>

    <p class="hint">An IPA download does not automatically install the application.</p>
  `;

  document.querySelectorAll(".page").forEach(el => el.hidden = true);
  $("details").hidden = false;
  window.scrollTo({top:0,behavior:"smooth"});
}

$("search").addEventListener("input",renderApps);

$("addSource").addEventListener("click",async () => {
  const url = safeURL($("sourceUrl").value.trim());
  const name = $("sourceName").value.trim() || "Custom repository";

  if (!url) return notify("Enter a valid HTTP or HTTPS URL.");

  if (sources.some(source => source.url === url)) {
    return notify("Repository already added.");
  }

  const source = {name,url,type:"url",status:"Loading..."};
  sources.push(source);
  saveSources();

  $("sourceUrl").value = "";
  $("sourceName").value = "";

  notify("Loading repository...");
  await reloadSources();

  notify(source.status === "Connected"
    ? `Added ${source.appCount} apps!`
    : "Couldn't load it. Try importing its JSON file.");
});

$("jsonInput").addEventListener("change",async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const catalog = JSON.parse(await file.text());
    normalizeCatalog(catalog,file.name);

    sources.push({
      name:file.name,
      type:"file",
      catalog,
      status:"Imported"
    });

    saveSources();
    await reloadSources();
    notify("Repository imported!");
  } catch (error) {
    notify("Import failed: " + error.message);
  }

  event.target.value = "";
});

function renderSources() {
  $("sourceList").innerHTML = sources.map((source,index) => `
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

async function removeSource(index) {
  sources.splice(index,1);
  saveSources();
  await reloadSources();
  notify("Repository removed.");
}

// IPA DATABASE

function openDB() {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open("EluxLocalFiles",1);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("ipas")) {
        request.result.createObjectStore("ipas",{keyPath:"id",autoIncrement:true});
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onerror = () => reject(request.error);
  });
}

function dbRequest(mode,action) {
  return new Promise((resolve,reject) => {
    if (!db) return reject(new Error("Storage is not ready."));

    const transaction = db.transaction("ipas",mode);
    const request = action(transaction.objectStore("ipas"));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function formatSize(bytes) {
  if (!bytes) return "Unknown size";

  const units = ["B","KB","MB","GB"];
  let size = bytes;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }

  return `${size.toFixed(1)} ${units[unit]}`;
}

async function saveIPA(file) {
  if (!file.name.toLowerCase().endsWith(".ipa")) {
    throw new Error("Please select a .ipa file.");
  }

  return dbRequest("readwrite",store => store.add({
    name:file.name,
    size:file.size,
    date:new Date().toISOString(),
    blob:file
  }));
}

$("ipaInput").addEventListener("change",async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    await saveIPA(file);
    notify("IPA added to My Apps!");
    await renderMyApps();
  } catch (error) {
    notify(error.message || "Could not save IPA.");
  }

  event.target.value = "";
});

async function renderMyApps() {
  if (!db) return;

  const files = await dbRequest("readonly",store => store.getAll());

  $("myCount").textContent = `${files.length} apps`;
  $("emptyMy").hidden = files.length > 0;

  $("myAppList").innerHTML = files.map(file => `
    <div class="app-row">
      <div>
        <strong>${escapeHTML(file.name)}</strong>
        <small>${formatSize(file.size)} · Imported IPA</small>
      </div>
      <button class="small-button" onclick="prepareInstall(${file.id})">Install Prep</button>
      <button class="small-button" onclick="deleteIPA(${file.id})">Delete</button>
    </div>
  `).join("");
}

async function deleteIPA(id) {
  await dbRequest("readwrite",store => store.delete(id));

  if (selectedIPA && selectedIPA.id === id) {
    selectedIPA = null;
    resetInstallSelection();
  }

  await renderMyApps();
  await renderInstallPrep();
  notify("IPA deleted.");
}

// INSTALL PREP

function resetInstallSelection() {
  $("selectedName").textContent = "No app selected";
  $("selectedSize").textContent = "—";
  $("selectedStatus").textContent = "Waiting";
  $("installButton").disabled = true;
}

async function prepareInstall(id) {
  const file = await dbRequest("readonly",store => store.get(id));
  if (!file) return notify("IPA not found.");

  selectedIPA = file;

  $("selectedName").textContent = file.name;
  $("selectedSize").textContent = formatSize(file.size);
  $("selectedStatus").textContent = "Selected — not verified";
  $("installButton").disabled = false;

  showPage("installprep");
}

async function renderInstallPrep() {
  if (!db) return;

  const files = await dbRequest("readonly",store => store.getAll());

  $("installChoices").innerHTML = files.map(file => `
    <div class="app-row">
      <div>
        <strong>${escapeHTML(file.name)}</strong>
        <small>${formatSize(file.size)}</small>
      </div>
      <button class="small-button" onclick="prepareInstall(${file.id})">Select</button>
    </div>
  `).join("") || `<p class="hint">Import an IPA into My Apps first.</p>`;
}

$("installButton").addEventListener("click",() => {
  if (!selectedIPA) return notify("Select an IPA first.");

  notify("Choose a compatible signing app to continue.");

  const instructions = [
    "ELUX INSTALLATION",
    "",
    "Your IPA is stored in Elux.",
    "To install it, use a compatible iOS signing tool.",
    "",
    "You need a valid signing identity and any required provisioning profile.",
    "",
    "Elux does not sign or install the IPA itself."
  ].join("\n");

  alert(instructions);
});

// CLEAR DATA

$("clearData").addEventListener("click",async () => {
  if (!confirm("Delete all Elux repositories and imported IPA files?")) return;

  sources = [];
  apps = [];
  selectedIPA = null;

  saveSources();

  await dbRequest("readwrite",store => store.clear());

  resetInstallSelection();
  await renderMyApps();
  await renderInstallPrep();
  await reloadSources();

  notify("Elux data cleared.");
  showPage("discover");
});

// START

async function start() {
  try {
    await openDB();
    await reloadSources();
    await renderMyApps();
    await renderInstallPrep();
  } catch (error) {
    console.error(error);
    notify("Local storage could not be opened.");
  }

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
  }
}

start();
