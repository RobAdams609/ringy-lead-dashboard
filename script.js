const dropZone = document.getElementById("drop-zone");
const dashboard = document.getElementById("dashboard");

dropZone.addEventListener("dragover", e => {
  e.preventDefault();
  dropZone.classList.add("hover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("hover");
});

dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("hover");

  const files = [...e.dataTransfer.files].filter(f =>
    f.name.toLowerCase().endsWith(".csv")
  );

  if (files.length !== 2) {
    alert("Drop EXACTLY 2 Ringy CSV files.");
    return;
  }

  Promise.all(files.map(readCSV)).then(allLeads => {
    const merged = allLeads.flat();
    renderDashboard(merged);
  });
});

/* =========================
   CSV PARSER + NORMALIZER
========================= */

function readCSV(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      resolve(parseCSV(text));
    };
    reader.readAsText(file);
  });
}

function normalizeHeader(h) {
  return h
    .toLowerCase()
    .replace(/\ufeff/g, "")
    .replace(/[^a-z]/g, "");
}

function parseCSV(csv) {
  const rows = csv.split("\n").map(r => r.split(","));
  const rawHeaders = rows.shift();

  const headers = rawHeaders.map(h => normalizeHeader(h));

  return rows
    .filter(r => r.length > 3)
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i]?.trim() || "";
      });
      return {
        first: obj.firstname || "",
        last: obj.lastname || "",
        phone: obj.phonenumber || obj.phone || "",
        email: obj.email || "",
        tags: obj.dispositiontags || obj.disposition || "",
        notes: obj.notes || obj.note || ""
      };
    });
}

/* =========================
   TIER DEFINITIONS
========================= */

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
      "objection, then sent quote"
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
      "website lead",
      "red"
    ]
  }
];

/* =========================
   CLASSIFICATION + RENDER
========================= */

function renderDashboard(leads) {
  dashboard.innerHTML = "";

  const buckets = {};
  TIERS.forEach(t => (buckets[t.name] = []));
  const misc = [];

  leads.forEach(lead => {
    const tagString = lead.tags.toLowerCase();
    let placed = false;

    for (const tier of TIERS) {
      if (tier.tags.some(t => tagString.includes(t))) {
        buckets[tier.name].push(lead);
        placed = true;
        break;
      }
    }

    if (!placed) misc.push(lead);
  });

  TIERS.forEach(tier => {
    renderSection(tier.name, tier.color, buckets[tier.name]);
  });

  renderSection("MISC / UNCLASSIFIED", "#ef4444", misc);
}

function renderSection(title, color, leads) {
  if (!leads.length) return;

  const section = document.createElement("section");

  const header = document.createElement("h2");
  header.textContent = `${title} (${leads.length})`;
  header.style.background = color;
  section.appendChild(header);

  leads.forEach(l => {
    const card = document.createElement("div");
    card.className = "lead-card";

    card.innerHTML = `
      <strong>${l.first || "No Name"} ${l.last}</strong><br/>
      ${l.phone}<br/>
      ${l.email}<br/>
      <small><strong>Tags:</strong> ${l.tags || "—"}</small>
      <small><strong>Notes:</strong> ${l.notes || "—"}</small>
    `;

    section.appendChild(card);
  });

  dashboard.appendChild(section);
}
