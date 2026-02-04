fetch("data/ringy_leads.csv")
  .then(res => res.text())
  .then(text => {
    const rows = text.split("\n").slice(1);
    const leads = rows
      .map(r => r.split(","))
      .filter(r => r.length > 5);

    const dashboard = document.getElementById("dashboard");

    leads
      .map(l => {
        const [
          first, last, email, phone, city, state, zip, dob,
          notes, tags, vendor, lastCalled, callCount, received
        ] = l;

        const tier = getTier(tags || "");
        return { first, last, email, phone, tags, vendor, lastCalled, notes, tier };
      })
      .sort((a, b) => a.tier - b.tier)
      .forEach(lead => dashboard.appendChild(renderCard(lead)));
  });

function getTier(tags) {
  if (/Appt Set|Quoted w F\/U/i.test(tags)) return 1;
  if (/Missed Appt|Quoted and Ghosted|Objection then sent Quote|Quotes Via SMS/i.test(tags)) return 2;
  if (/Hit List\/Ghosted|Manual Added Ghosted/i.test(tags)) return 3;
  if (/Positive|Auto|Reply|Opened Email|Email Replied|smallBusiness/i.test(tags)) return 4;
  if (/New Purchased Lead|Personal Social Media Leads|Website Lead/i.test(tags)) return 5;
  return 6;
}

function renderCard(lead) {
  const card = document.createElement("div");
  card.className = `lead-card tier-${lead.tier}`;

  card.innerHTML = `
    <div class="name">${lead.first} ${lead.last}</div>
    <div>${lead.phone || ""}</div>
    <div>${lead.email || ""}</div>
    <div class="meta">Tags: ${lead.tags || ""}</div>
    <div class="meta">Vendor: ${lead.vendor || ""}</div>
    <div class="details">
      <div>Last Called: ${lead.lastCalled || ""}</div>
      <div>Notes: ${lead.notes || ""}</div>
    </div>
  `;

  return card;
}
