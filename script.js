const fileInput = document.getElementById("fileInput");
const dashboard = document.getElementById("dashboard");

fileInput.addEventListener("change", () => {
  const files = [...fileInput.files].filter(f => f.name.endsWith(".csv"));

  if (files.length !== 2) {
    alert("You must select EXACTLY 2 CSV files.");
    return;
  }

  Promise.all(files.map(readCSV)).then(results => {
    const mergedLeads = results.flat();
    buildDashboard(mergedLeads);
  });
});

/* ========================
   CSV PARSING (ROBUST)
======================== */

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
      const data = {};
      headers.forEach((h, i) => data[h] = row[i]?.trim() || "");
      return {
        first: data.firstname || "",
        last: data.lastname || "",
        phone: data.phonenumber || data.phone || "",
        email: data.email || "",
        tags: data.dispositiontags || data.disposition || "",
        notes: data.notes || data.note || ""
      };
    });
}

/* ========================
   TIER DEFINITIONS
======================== */

const TIERS = [
  {
    name: "NEW MONEY",
    color: "#22c55e",
    tags: ["appt set", "quoted w f/u"]
  },
  {
    name: "MISSING MONEY",
    color: "#2563eb",
    tags: [
      "quotes via sms",
      "missed appt",
      "quoted and ghosted",
      "objection"
    ]
  },
  {
    name: "MONEY CAN’T HIDE",
    color: "#60a5fa",
    tags: ["hit list/ghosted", "manual added ghosted"]
  },
  {
    name: "COMING FOR MONEY",
    color: "#4ade80",
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
    tags: [
      "new purchased lead",
      "personal social media leads",
      "website lead"
    ]
  }
];

/* ========================
   DASHBOARD BUILD
======================== */

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

  TIERS.forEach(t => renderSection(t.name, t.color, buckets[t.name]));
  renderSection("MISC / UNCLASSIFIED", "#ef4444", misc);
}

function renderSection(title, color, leads) {
  if (!leads.length) return;

  const section = document.createElement("section");

  const header = document.createElement("div");
  header.className = "section-header";
  header.style.background = color;
  header.textContent = `${title} (${leads.length})`;
  section.appendChild(header);

  leads.forEach(l => {
    const card = document.createElement("div");
    card.className = "lead-card";
    card.style.borderLeftColor = color;

    card.innerHTML = `
      <strong>${l.first || "No Name"} ${l.last || ""}</strong>
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
