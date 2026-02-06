const fileInput = document.getElementById("fileInput");
const dashboard = document.getElementById("dashboard");

fileInput.addEventListener("change", () => {
  const files = [...fileInput.files].filter(f => f.name.endsWith(".csv"));
  if (files.length !== 2) {
    alert("You must select EXACTLY 2 CSV files.");
    return;
  }

  Promise.all(files.map(readCSV)).then(results => {
    const merged = results.flat();
    buildDashboard(merged);
  });
});

/* =====================
   CSV PARSING
===================== */

function readCSV(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve(parseCSV(e.target.result));
    reader.readAsText(file);
  });
}

function normalizeHeader(h) {
  return h.toLowerCase().replace(/[^a-z]/g, "");
}

function parseCSV(text) {
  const rows = text.split("\n").map(r => r.split(","));
  const rawHeaders = rows.shift();
  const headers = rawHeaders.map(normalizeHeader);

  return rows
    .filter(r => r.length > 3)
    .map(row => {
      const d = {};
      headers.forEach((h, i) => d[h] = row[i]?.trim() || "");
      return {
        first: d.firstname || "",
        last: d.lastname || "",
        phone: d.phonenumber || d.phone || "",
        email: d.email || "",
        tags: d.dispositiontags || d.disposition || "",
        notes: d.notes || ""
      };
    });
}

/* =====================
   TIER DEFINITIONS
===================== */

const TIERS = [
  {
    name: "NEW MONEY",
    color: "#22c55e",
    css: "tier-1",
    tags: ["appt set", "quoted w f/u"]
  },
  {
    name: "MISSING MONEY",
    color: "#2563eb",
    css: "tier-2",
    tags: ["quotes via sms", "missed appt", "quoted and ghosted", "objection"]
  },
  {
    name: "MONEY CAN’T HIDE",
    color: "#60a5fa",
    css: "tier-3",
    tags: ["hit list/ghosted", "manual added ghosted"]
  },
  {
    name: "COMING FOR MONEY",
    color: "#4ade80",
    css: "tier-4",
    tags: [
      "positive positive positive",
      "positive auto reply",
      "auto ind medical",
      "auto family",
      "op reply",
      "td reply",
      "onlysales reply",
      "opened email",
      "email replied",
      "positive -smallbusiness"
    ]
  },
  {
    name: "TODAY’S MONEY",
    color: "#fde047",
    css: "tier-5",
    tags: [
      "new purchased lead",
      "personal social media leads",
      "website lead"
    ]
  }
];

/* =====================
   DASHBOARD BUILD
===================== */

function buildDashboard(leads) {
  dashboard.innerHTML = "";

  const buckets = {};
  TIERS.forEach(t => buckets[t.name] = []);
  const misc = [];

  leads.forEach(lead => {
    const tagText = lead.tags.toLowerCase();
    let matched = false;

    for (const tier of TIERS) {
      if (tier.tags.some(t => tagText.includes(t))) {
        buckets[tier.name].push(lead);
        matched = true;
        break;
      }
    }

    if (!matched) misc.push(lead);
  });

  TIERS.forEach(t =>
    renderSection(t.name, t.color, t.css, buckets[t.name])
  );

  renderSection("MISC / UNCLASSIFIED", "#ef4444", "tier-misc", misc);
}

function renderSection(title, color, cssClass, leads) {
  if (!leads.length) return;

  const section = document.createElement("section");

  const header = document.createElement("div");
  header.className = "section-header";
  header.style.background = color;
  header.textContent = `${title} (${leads.length})`;
  section.appendChild(header);

  leads.forEach(l => {
    const card = document.createElement("div");
    card.className = `lead-card ${cssClass}`;
    card.style.borderLeftColor = color;

    card.innerHTML = `
      <div class="lead-name">${l.first || "No Name"} ${l.last || ""}</div>
      <div class="lead-meta">
        <span>${l.phone}</span>
        <span>${l.email}</span>
        <span><strong>Tags:</strong> ${l.tags || "—"}</span>
        <span><strong>Notes:</strong> ${l.notes || "—"}</span>
      </div>
    `;

    section.appendChild(card);
  });

  dashboard.appendChild(section);
}
