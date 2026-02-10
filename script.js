/***********************
  Lead Command Dashboard
  - Drop 2 CSV files
  - Merge rows
  - Categorize by Disposition tags
  - If no match -> MISC
************************/

const dashboardEl = document.getElementById("dashboard");
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const fileStatus = document.getElementById("fileStatus");
const errorBox = document.getElementById("errorBox");

// ====== Tier Definitions (exactly what you specified) ======
const TIERS = [
  {
    key: "newMoney",
    label: "NEW MONEY",
    colorVar: "--newMoney",
    keywords: ["Appt Set", "Quoted w F/U"],
  },
  {
    key: "missingMoney",
    label: "MISSING MONEY",
    colorVar: "--missingMoney",
    keywords: ["Quotes Via SMS", "Missed Appt", "Quoted and Ghosted", "Objection, then sent Quote"],
  },
  {
    key: "moneyCantHide",
    label: "MONEY CANT HIDE",
    colorVar: "--moneyCantHide",
    keywords: ["Hit List/Ghosted", "Manual Added Ghosted"],
  },
  {
    key: "comingForMoney",
    label: "COMING FOR MONEY",
    colorVar: "--comingForMoney",
    keywords: [
      "Positive positive positive",
      "Positive Auto Reply",
      "Auto Ind Medical",
      "Auto Family",
      "Op Reply",
      "TD Reply",
      "OnlySales Reply",
      "Opened Email",
      "Email Replied",
      "positive -smallBusiness",
    ],
  },
  {
    key: "todaysMoney",
    label: "TODAY’S MONEY",
    colorVar: "--todaysMoney",
    keywords: ["New Purchased Lead", "Personal Social Media Leads", "Website Lead"],
  },
];

const MISC = {
  key: "misc",
  label: "MISC / UNCLASSIFIED",
  colorVar: "--misc",
};

// ====== Utilities ======
function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
}
function clearError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

function safeStr(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

/**
 * Normalize strings so matching can't fail due to invisible chars
 * (this is the exact class of problem that causes “looks identical” but doesn’t match)
 */
function normalizeText(s) {
  return safeStr(s)
    // remove zero-width + BOM + NBSP + odd whitespace
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, " ")
    // normalize line breaks
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // collapse spaces
    .replace(/[ \t]+/g, " ")
    .trim()
    .toLowerCase();
}

function splitDispositionTags(raw) {
  // Ringy "Disposition tags" comes like: "Missed Appt | Iphone"
  // We need individual tokens from the pipe.
  const s = safeStr(raw);
  if (!s) return [];
  return s.split("|").map(t => t.trim()).filter(Boolean);
}

function formatDateMaybe(iso) {
  const s = safeStr(iso).trim();
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  // compact local
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * CSV parser (no external libs) that handles quoted fields + commas.
 */
function parseCSV(text) {
  const rows = [];
  let i = 0;
  let field = "";
  let row = [];
  let inQuotes = false;

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        // possible escaped quote
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        field += c;
        i++;
        continue;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (c === ",") {
        row.push(field);
        field = "";
        i++;
        continue;
      }
      if (c === "\n") {
        row.push(field);
        field = "";
        // ignore fully empty trailing row
        if (row.some(cell => safeStr(cell).trim() !== "")) rows.push(row);
        row = [];
        i++;
        continue;
      }
      field += c;
      i++;
    }
  }

  // last field
  row.push(field);
  if (row.some(cell => safeStr(cell).trim() !== "")) rows.push(row);

  // Build objects
  if (rows.length === 0) return [];
  const headers = rows[0].map(h => safeStr(h).trim());
  const data = [];

  for (let r = 1; r < rows.length; r++) {
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = rows[r][c] ?? "";
    }
    data.push(obj);
  }
  return data;
}

/**
 * Merge two CSV datasets:
 * - union of rows
 * - de-dupe by Phone number + Email (best stable key in your export)
 */
function mergeLeads(listA, listB) {
  const all = [...listA, ...listB];
  const seen = new Set();
  const out = [];

  for (const lead of all) {
    const phone = normalizeText(lead["Phone number"] ?? lead["Phone"] ?? "");
    const email = normalizeText(lead["Email"] ?? "");
    const key = `${phone}__${email}`;

    if (!seen.has(key)) {
      seen.add(key);
      out.push(lead);
    } else {
      // If duplicate exists, prefer the one with Notes or more tags
      const idx = out.findIndex(x => {
        const p = normalizeText(x["Phone number"] ?? x["Phone"] ?? "");
        const e = normalizeText(x["Email"] ?? "");
        return `${p}__${e}` === key;
      });
      if (idx >= 0) {
        const curr = out[idx];
        const currNotes = safeStr(curr["Notes"]).trim();
        const newNotes = safeStr(lead["Notes"]).trim();
        const currTags = safeStr(curr["Disposition tags"]).trim();
        const newTags = safeStr(lead["Disposition tags"]).trim();

        const score = (n, t) => (n ? 2 : 0) + (t ? 1 : 0) + t.split("|").length * 0.01;
        if (score(newNotes, newTags) > score(currNotes, currTags)) out[idx] = lead;
      }
    }
  }

  return out;
}

/**
 * Assign tier:
 * - split disposition tags by "|"
 * - normalize each tag token
 * - first tier in TIERS order that matches any keyword wins
 * - otherwise MISC
 */
function categorizeLead(lead) {
  const rawTags = safeStr(lead["Disposition tags"]);
  const tokens = splitDispositionTags(rawTags);
  const normTokens = tokens.map(t => normalizeText(t));

  for (const tier of TIERS) {
    for (const kw of tier.keywords) {
      const nkw = normalizeText(kw);

      // Exact match OR "token starts with keyword" (covers "Missed Appt | Iphone")
      const hit = normTokens.some(tok => tok === nkw || tok.startsWith(nkw));
      if (hit) return tier;
    }
  }

  return MISC;
}

function getLeadName(lead) {
  const first = safeStr(lead["First name"]).trim();
  const last = safeStr(lead["Last name"]).trim();
  const full = `${first} ${last}`.trim();
  return full || "No Name";
}

function renderSection(sectionDef, leads) {
  const section = document.createElement("section");
  section.className = "section";

  const header = document.createElement("div");
  header.className = "sectionHeader";
  header.style.background = `var(${sectionDef.colorVar})`;

  const title = document.createElement("div");
  title.textContent = sectionDef.label;

  const count = document.createElement("div");
  count.className = "count";
  count.textContent = `${leads.length}`;

  header.appendChild(title);
  header.appendChild(count);

  const body = document.createElement("div");
  body.className = "sectionBody";

  const cards = document.createElement("div");
  cards.className = "cards";

  for (const lead of leads) {
    const card = document.createElement("div");
    card.className = "card";
    card.style.setProperty("--tierColor", `var(${sectionDef.colorVar})`);
    // left border color
    card.style.setProperty("--misc", `var(${sectionDef.colorVar})`);
    // We use ::before background from --misc, so override it per card:
    card.style.setProperty("--misc", `var(${sectionDef.colorVar})`);

    const name = getLeadName(lead);
    const phone = safeStr(lead["Phone number"]).trim();
    const email = safeStr(lead["Email"]).trim();

    const tagsRaw = safeStr(lead["Disposition tags"]).trim() || "—";
    const notesRaw = safeStr(lead["Notes"]).trim() || "—";

    const vendor = safeStr(lead["Lead vendor"]).trim() || "—";
    const state = safeStr(lead["State"]).trim() || "—";
    const zip = safeStr(lead["ZIP code"]).trim() || "—";

    const received = formatDateMaybe(lead["Received on"]);
    const lastCalled = formatDateMaybe(lead["Last called"]);
    const timesCalled = safeStr(lead["Num times called"]).trim() || "—";

    const headerRow = document.createElement("div");
    headerRow.className = "cardHeader";

    const nameEl = document.createElement("div");
    nameEl.className = "name";
    nameEl.textContent = name;

    headerRow.appendChild(nameEl);

    const metaLine = document.createElement("div");
    metaLine.className = "metaLine";
    metaLine.innerHTML = `
      <span><strong>Phone:</strong> ${
        phone ? `<a class="link" href="tel:${phone}">${phone}</a>` : "—"
      }</span>
      <span><strong>Email:</strong> ${
        email ? `<a class="link" href="mailto:${email}">${email}</a>` : "—"
      }</span>
      <span><strong>Vendor:</strong> ${vendor}</span>
      <span><strong>State/Zip:</strong> ${state} ${zip}</span>
    `;

    const kv = document.createElement("div");
    kv.className = "kv";
    kv.innerHTML = `
      <div><strong>Tags:</strong> ${escapeHTML(tagsRaw)}</div>
      <div><strong>Notes:</strong> ${escapeHTML(notesRaw)}</div>
    `;

    const small = document.createElement("div");
    small.className = "metaLine";
    small.innerHTML = `
      <span><strong>Received:</strong> ${received}</span>
      <span><strong>Last called:</strong> ${lastCalled}</span>
      <span><strong># Called:</strong> ${timesCalled}</span>
    `;

    card.appendChild(headerRow);
    card.appendChild(metaLine);
    card.appendChild(kv);
    card.appendChild(small);

    cards.appendChild(card);
  }

  body.appendChild(cards);
  section.appendChild(header);
  section.appendChild(body);

  return section;
}

function escapeHTML(s) {
  return safeStr(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderDashboard(allLeads) {
  dashboardEl.innerHTML = "";

  // bucket by tier
  const buckets = new Map();
  for (const tier of TIERS) buckets.set(tier.key, []);
  buckets.set(MISC.key, []);

  for (const lead of allLeads) {
    const tier = categorizeLead(lead);
    buckets.get(tier.key).push(lead);
  }

  // sort inside each tier (optional but helpful): most recently received first
  const sortByReceivedDesc = (a, b) => {
    const da = new Date(safeStr(a["Received on"])).getTime();
    const db = new Date(safeStr(b["Received on"])).getTime();
    return (isNaN(db) ? 0 : db) - (isNaN(da) ? 0 : da);
  };

  for (const tier of TIERS) {
    const leads = buckets.get(tier.key);
    leads.sort(sortByReceivedDesc);
    dashboardEl.appendChild(renderSection(tier, leads));
  }

  const miscLeads = buckets.get(MISC.key);
  miscLeads.sort(sortByReceivedDesc);
  dashboardEl.appendChild(renderSection(MISC, miscLeads));
}

// ====== File Handling ======
async function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(safeStr(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

async function handleFiles(files) {
  clearError();

  const list = Array.from(files || []);
  if (list.length !== 2) {
    showError(`You must drop EXACTLY 2 CSV files. You selected ${list.length}.`);
    dashboardEl.innerHTML = "";
    return;
  }

  fileStatus.textContent = `${list.length} files selected`;

  try {
    const [t1, t2] = await Promise.all([readFileText(list[0]), readFileText(list[1])]);
    const leads1 = parseCSV(t1);
    const leads2 = parseCSV(t2);

    const merged = mergeLeads(leads1, leads2);
    renderDashboard(merged);
  } catch (e) {
    showError(`Failed to read/parse CSVs. ${e?.message || e}`);
    dashboardEl.innerHTML = "";
  }
}

// ====== Events ======
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener("change", (e) => {
  handleFiles(e.target.files);
});

// initial state
fileStatus.textContent = "No files selected";
dashboardEl.innerHTML = "";
