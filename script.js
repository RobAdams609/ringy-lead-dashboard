fetch("leads.csv")
  .then(res => res.text())
  .then(csv => {
    const rows = csv.split("\n").map(r => r.split(","));
    const headers = rows.shift().map(h => h.trim().toLowerCase());

    const leads = rows
      .filter(r => r.length > 1)
      .map(r => {
        const obj = {};
        headers.forEach((h, i) => (obj[h] = (r[i] || "").trim()));
        return obj;
      });

    const dashboard = document.getElementById("dashboard");
    dashboard.innerHTML = "";

    const usedLeadIds = new Set();

    const TIERS = [
      {
        name: "New Money Tier",
        color: "#16a34a",
        tags: ["appt set", "quoted w f/u"]
      },
      {
        name: "Missing Money Tier",
        color: "#2563eb",
        tags: [
          "quotes via sms",
          "missed appt",
          "quoted and ghosted",
          "objection, then sent quote"
        ]
      },
      {
        name: "Money Cant Hide",
        color: "#60a5fa",
        tags: ["hit list/ghosted", "manual added ghosted"]
      },
      {
        name: "Coming for Money",
        color: "#22c55e",
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
        name: "Today’s Money",
        color: "#fde047",
        tags: [
          "new purchased lead",
          "personal social media leads",
          "website lead"
        ]
      }
    ];

    function normalize(str) {
      return str.toLowerCase();
    }

    function getTags(lead) {
      return normalize(lead["disposition tags"] || lead["tags"] || "");
    }

    function renderSection(title, color, leads) {
      if (!leads.length) return;

      const section = document.createElement("section");
      section.style.marginBottom = "28px";

      const header = document.createElement("h2");
      header.textContent = title;
      header.style.borderLeft = `6px solid ${color}`;
      header.style.paddingLeft = "10px";
      header.style.marginBottom = "12px";

      section.appendChild(header);

      leads.forEach(lead => {
        const card = document.createElement("div");
        card.style.borderLeft = `6px solid ${color}`;
        card.style.background = "#ffffff";
        card.style.padding = "12px";
        card.style.marginBottom = "8px";
        card.style.borderRadius = "6px";
        card.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";

        card.innerHTML = `
          <strong>${lead.name || "No Name"}</strong><br/>
          ${lead.phone || ""}<br/>
          ${lead.email || ""}<br/>
          <em>${lead.vendor || ""}</em><br/>
          <small><strong>Tags:</strong> ${lead["disposition tags"] || ""}</small><br/>
          <small><strong>Notes:</strong> ${lead.notes || ""}</small>
        `;

        section.appendChild(card);
      });

      dashboard.appendChild(section);
    }

    // ---- MAIN TIER PASS ----
    TIERS.forEach(tier => {
      const matched = [];

      leads.forEach(lead => {
        if (usedLeadIds.has(lead.id)) return;

        const tagText = getTags(lead);

        const isMatch = tier.tags.some(t => tagText.includes(t));

        if (isMatch) {
          usedLeadIds.add(lead.id);
          matched.push(lead);
        }
      });

      renderSection(tier.name, tier.color, matched);
    });

    // ---- MISC / RED (EXPLICIT CATCH-ALL) ----
    const miscLeads = leads.filter(l => !usedLeadIds.has(l.id));

    renderSection("MISC / Unclassified", "#dc2626", miscLeads);
  });
