fetch("leads.csv")
  .then(res => res.text())
  .then(csv => {
    const rows = csv.split("\n").map(r => r.split(","));
    const headers = rows.shift().map(h => h.trim().toLowerCase());

    const leads = rows
      .filter(r => r.length > 3)
      .map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = row[i]?.trim() || "";
        });
        return obj;
      });

    const dashboard = document.getElementById("dashboard");
    dashboard.innerHTML = "";

    /* =========================
       TIER DEFINITIONS (ORDER MATTERS)
       Highest priority FIRST
    ========================== */

    const TIERS = [
      {
        name: "NEW MONEY",
        color: "#22c55e", // bright green
        tags: [
          "appt set",
          "quoted w f/u"
        ]
      },
      {
        name: "MISSING MONEY",
        color: "#2563eb", // darker blue
        tags: [
          "quotes via sms",
          "missed appt",
          "quoted and ghosted",
          "objection, then sent quote"
        ]
      },
      {
        name: "MONEY CAN’T HIDE",
        color: "#60a5fa", // light blue
        tags: [
          "hit list/ghosted",
          "manual added ghosted"
        ]
      },
      {
        name: "COMING FOR MONEY",
        color: "#4ade80", // slightly darker green
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
        color: "#fde047", // yellow
        tags: [
          "new purchased lead",
          "personal social media leads",
          "website lead",
          "red"
        ]
      }
    ];

    const sections = {};
    TIERS.forEach(t => (sections[t.name] = []));

    const misc = [];

    /* =========================
       CLASSIFICATION LOGIC
    ========================== */

    leads.forEach(lead => {
      const tagString =
        (lead["disposition tags"] || "").toLowerCase();

      let placed = false;

      for (const tier of TIERS) {
        if (tier.tags.some(t => tagString.includes(t))) {
          sections[tier.name].push(lead);
          placed = true;
          break; // highest tier wins
        }
      }

      if (!placed) {
        misc.push(lead);
      }
    });

    /* =========================
       RENDERING
    ========================== */

    function renderSection(title, color, leads) {
      if (!leads.length) return;

      const section = document.createElement("section");

      const header = document.createElement("h2");
      header.textContent = `${title} (${leads.length})`;
      header.style.background = color;

      section.appendChild(header);

      leads.forEach(lead => {
        const card = document.createElement("div");

        card.innerHTML = `
          <strong>${lead["first name"] || ""} ${lead["last name"] || ""}</strong><br/>
          ${lead["phone number"] || ""}<br/>
          ${lead["email"] || ""}<br/>
          <small><strong>Tags:</strong> ${lead["disposition tags"] || "—"}</small>
          <small><strong>Notes:</strong> ${lead["notes"] || "—"}</small>
        `;

        section.appendChild(card);
      });

      dashboard.appendChild(section);
    }

    /* =========================
       OUTPUT (ORDERED)
    ========================== */

    TIERS.forEach(tier => {
      renderSection(tier.name, tier.color, sections[tier.name]);
    });

    renderSection("MISC / UNCLASSIFIED", "#ef4444", misc);
  })
  .catch(err => {
    console.error("Failed to load CSV:", err);
  });
