const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("fileInput");
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
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener("change", e => {
  handleFiles(e.target.files);
});

function handleFiles(files) {
  const csvFiles = [...files].filter(f => f.name.endsWith(".csv"));
  if (csvFiles.length < 2) {
    alert("Drop BOTH Ringy CSV files.");
    return;
  }

  Promise.all(csvFiles.map(readCSV))
    .then(results => {
      const combined = results.flat();
      renderLeads(combined);
    });
}

function readCSV(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const lines = e.target.result.split("\n");
      const headers = lines.shift().split(",");
      const rows = lines.map(line => {
        const values = line.split(",");
        const obj = {};
        headers.forEach((h, i) => obj[h.trim()] = values[i]?.trim());
        return obj;
      });
      resolve(rows.filter(r => r["Disposition tags"]));
    };
    reader.readAsText(file);
  });
}

function getTier(disposition = "") {
  if (disposition.includes("Appt Set")) return 1;
  if (disposition.includes("Quoted")) return 2;
  if (disposition.includes("Hit List")) return 3;
  if (disposition.includes("Positive")) return 4;
  return 5;
}

function renderLeads(leads) {
  dashboard.innerHTML = "";

  leads
    .map(l => ({ ...l, tier: getTier(l["Disposition tags"]) }))
    .sort((a, b) => a.tier - b.tier)
    .forEach(lead => {
      const card = document.createElement("div");
      card.className = `lead-card tier-${lead.tier}`;

      card.innerHTML = `
        <strong>${lead["First name"] || ""} ${lead["Last name"] || ""}</strong>
        <div>${lead["Phone number"] || ""}</div>
        <div>${lead["Email"] || ""}</div>
        <small>${lead["Disposition tags"]}</small>
      `;

      dashboard.appendChild(card);
    });
}
