/*
 * Owner dashboard and client-side PDF generation.
 * Configure APPS_SCRIPT_URL to the same deployed Web App URL used by app.js.
 * The dashboard key is entered by the owner at runtime; it is not stored in this file.
 */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwrP7bc3q3AVvyuxct1kNY8HxIQBxh7tbvy2Qlvvzs4oon-3lbMtjTe2hJAwaEyTrwH/exec";
const VEHICLE = { model: "MG ZS Lux 2025", plate: "GBJ 3556", color: "Black" };
const TERMS = [
  ["Vehicle Details", "The rented vehicle is an MG ZS Lux 2025, black, registration plate GBJ 3556. The renter must inspect the vehicle and report any pre-existing damage before departure."],
  ["Rental Period", "The rental begins at the agreed pick-up date and time and ends at the agreed return date and time. The renter must return the vehicle on time to the agreed location. Extensions or late returns, and any fees associated, must be agreed by the owner in writing."],
  ["Fuel Policy", "The vehicle's departure fuel level is recorded on this agreement. Unless the owner agrees otherwise in writing, the renter must return the vehicle with the same fuel level. Refuelling or charge fees may apply if returned with less fuel."],
  ["Renter's Obligations", "The renter confirms that their driver's licence is valid for the rental period and must carry the licence and required vehicle documents while driving. The renter must follow all applicable traffic laws, report any collisions promptly, and not allow unlisted drivers to operate the vehicle."],
  ["Damage / Loss", "The renter must promptly report any collision, theft, damage, impoundment, or third-party claim and cooperate with lawful reporting and insurance procedures. The renter may be responsible for repair costs and replacement where applicable, subject to any security deposit and insurance terms agreed separately."],
  ["Security Deposit", "Any security deposit amount, payment method, deductions, and refund timeline must be separately disclosed and agreed in writing before handover. Deductions for damage, cleaning, or unpaid fees will be detailed and documented by the owner."],
  ["Prohibited Use", "The vehicle must not be used for unlawful activity, racing, towing without permission, driving while impaired, carrying prohibited goods, sub-renting, or off-road use without prior written permission."],
  ["Return Checklist", "At return, the parties should record the return date and time, odometer reading, fuel level, visible condition and any new damage, keys and accessories returned."],
  ["Privacy and Recordkeeping", "The renter understands that the details submitted are used to administer the rental, contact the renter in connection with the rental, document consent, and maintain records in connection with the rental and any related claims. The owner will handle personal data in accordance with applicable privacy rules."]
];

let adminKey = "";
let records = [];

const $ = id => document.getElementById(id);
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
}
function fmt(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}
function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}
function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const datePart = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  const timePart = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
  return `${datePart} at ${timePart}`;
}
function period(record) {
  // For display in the dashboard table keep original values, but presentationally we could format here if desired
  return `${record.pickupDate || "—"} → ${record.returnDate || "—"}`;
}
async function loadRecords() {
  const status = $("loadStatus");
  status.textContent = "Loading records…";
  if (APPS_SCRIPT_URL.includes("PASTE_YOUR")) {
    status.textContent = "Setup required: configure APPS_SCRIPT_URL in dashboard.js.";
    return;
  }
  try {
    const result = await requestRecordsJsonp();
    if (!result.ok) throw new Error(result.error || "The server rejected the request.");
    records = Array.isArray(result.records) ? result.records : [];
    renderRecords();
    status.textContent = `Loaded ${records.length} record(s) at ${new Date().toLocaleTimeString()}.`;
  } catch (error) {
    console.error(error);
    status.textContent = "Could not load records. Verify the Apps Script URL, deployment permissions, dashboard key, and browser console.";
  }
}

function requestRecordsJsonp() {
  /*
   * Apps Script ContentService responses can be awkward to read with cross-origin
   * fetch from a static site. JSONP via a script element avoids CORS, and the
   * callback name is generated locally. The admin key remains entered at runtime.
   */
  return new Promise((resolve, reject) => {
    const callbackName = "__rentalRecordsCallback";
    const previous = window[callbackName];
    const script = document.createElement("script");
    const url = new URL(APPS_SCRIPT_URL);
    let finished = false;
    const cleanup = () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      if (previous === undefined) delete window[callbackName];
      else window[callbackName] = previous;
    };
    const timeout = window.setTimeout(() => {
      if (finished) return;
      finished = true; cleanup();
      reject(new Error("Timed out while loading records."));
    }, 20000);
    window[callbackName] = result => {
      if (finished) return;
      finished = true; window.clearTimeout(timeout); cleanup(); resolve(result);
    };
    script.onerror = () => {
      if (finished) return;
      finished = true; window.clearTimeout(timeout); cleanup();
      reject(new Error("Could not load the Apps Script response."));
    };
    url.searchParams.set("action", "list");
    url.searchParams.set("key", adminKey);
    url.searchParams.set("callback", callbackName);
    url.searchParams.set("_", String(Date.now()));
    script.src = url.toString();
    document.head.appendChild(script);
  });
}

function renderRecords() {
  const query = $("searchInput").value.trim().toLowerCase();
  const filtered = records.filter(r => [r.fullName,r.contact,r.email,r.vehiclePlate,r.licenseNo].some(v => String(v || "").toLowerCase().includes(query)));
  $("totalRecords").textContent = records.length;
  $("acceptedCount").textContent = records.filter(r => String(r.agreementAccepted).toLowerCase() === "yes").length;
  $("latestRecord").textContent = records.length ? fmt(records[records.length - 1].timestamp) : "—";
  const body = $("recordsBody");
  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="8" class="text-slate-500">${records.length ? "No records match your search." : "No records found."}</td></tr>`;
    return;
  }
  body.innerHTML = filtered.map(r => {
    const index = records.indexOf(r);
    return `<tr>
      <td>${escapeHtml(fmt(r.timestamp))}</td>
      <td><strong>${escapeHtml(r.fullName || "—")}</strong><div class="text-xs text-slate-500">${escapeHtml(r.email || "")}</div></td>
      <td>${escapeHtml(r.contact || "—")}</td>
      <td>${escapeHtml(period(r))}</td>
      <td>${escapeHtml(r.totalDays || "—")}</td>
      <td>${escapeHtml(r.vehicleModel || VEHICLE.model)}<div class="text-xs text-slate-500">${escapeHtml(r.vehiclePlate || VEHICLE.plate)} · ${escapeHtml(r.vehicleColor || VEHICLE.color)}</div></td>
      <td><span class="rounded-full px-2 py-1 text-xs ${String(r.agreementAccepted).toLowerCase()==="yes"?"bg-green-100 text-green-800":"bg-red-100 text-red-800"}">${escapeHtml(String(r.agreementAccepted || "No"))}</span></td>
      <td><button class="pdfBtn rounded-lg bg-slate-900 hover:bg-slate-700 text-white px-3 py-2 whitespace-nowrap" data-index="${index}">Download Agreement PDF</button></td>
    </tr>`;
  }).join("");
  body.querySelectorAll(".pdfBtn").forEach(button => button.addEventListener("click", () => {
    const record = records[Number(button.dataset.index)];
    if (record) downloadAgreementPdf(record);
  }));
}
function addWrapped(doc, text, x, y, maxWidth, lineHeight = 5) {
  const lines = doc.splitTextToSize(String(text ?? "—"), maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}
function downloadAgreementPdf(r) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("PDF library did not load. Check your internet connection and CDN access.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14; // slightly smaller margin to fit more content
  const maxWidth = pageWidth - margin * 2;
  const labelWidth = 56; // smaller label column
  let y = 18; // move content up to fit more

  function ensureSpace(required = 10) {
    if (y + required > pageHeight - 14) {
      doc.addPage();
      y = 18;
    }
  }

  function addField(label, value) {
    ensureSpace(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`${label}:`, margin, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(String(value ?? "—"), maxWidth - labelWidth - 4);
    doc.text(lines, margin + labelWidth, y);
    y += Math.max(5, lines.length * 4);
  }

  function addParagraph(text) {
    const lines = doc.splitTextToSize(String(text ?? "—"), maxWidth);
    ensureSpace(lines.length * 4 + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 4;
  }

  function addSectionTitle(title) {
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title, margin, y);
    y += 6;
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y - 2, pageWidth - margin, y - 2);
    y += 4;
  }

  function addSignatureBlock() {
    const sigY = y + 6;
    const leftX = margin;
    const rightX = pageWidth - margin - 70;
    const lineLength = 70;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    doc.line(leftX, sigY, leftX + lineLength, sigY);
    doc.line(rightX, sigY, rightX + lineLength, sigY);

    doc.text("Renter signature / date", leftX, sigY + 6);
    doc.text("Owner / representative signature / date", rightX, sigY + 6);
  }

  function addAgreementSummary() {
    addSectionTitle("5. COMPLETE AGREEMENT SUMMARY");
    addParagraph(`This rental agreement is for ${r.vehicleModel || VEHICLE.model}, ${r.vehicleColor || VEHICLE.color}, plate ${r.vehiclePlate || VEHICLE.plate}. The renter, ${r.fullName || "—"}, agrees to the full terms in this document and confirms that the vehicle condition, dates, and obligations were reviewed before acceptance.`);
    addParagraph(`Rental period: ${formatDateTime(r.pickupDate)} to ${formatDateTime(r.returnDate)} (${r.totalDays || "—"} day(s)). Odometer out: ${r.odometerOut || "—"} km. Fuel level out: ${r.fuelLevelOut || "—"}.`);
    addParagraph(`Contact details: ${r.contact || "—"}; Address: ${r.address || "—"}; Email: ${r.email || "—"}. Emergency contact: ${r.emergencyName || "—"} (${r.emergencyPhone || "—"}).`);
    addParagraph(`Driver's licence: ${r.licenseNo || "—"}; expiry ${formatDate(r.licenseExpiry)}. Government ID: ${r.govIdType || "—"} ${r.govIdNumber || "—"}.`);
    addParagraph(`Pre-existing damage / notes: ${r.notes || "No additional notes recorded."}`);
    addParagraph(`Agreement accepted: ${String(r.agreementAccepted || "No").toUpperCase()}. Record timestamp: ${r.timestamp ? formatDateTime(r.timestamp) : "Not available"}. Terms version: ${r.termsVersion || "1.0"}.`);
  }

  // header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("VEHICLE RENTAL AGREEMENT", margin, 16);

  // make vehicle line white so it's visible on the dark header
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${r.vehicleModel || VEHICLE.model} | Plate ${r.vehiclePlate || VEHICLE.plate} | ${r.vehicleColor || VEHICLE.color}`, margin, 26);

  // switch back to black for the rest of the document
  doc.setTextColor(0, 0, 0);

  y = 40;

  addSectionTitle("1. RENTER INFORMATION");
  addField("Full legal name", r.fullName);
  addField("Contact number", r.contact);
  addField("Address", r.address);
  addField("Email", r.email);
  addField("Date of birth", formatDate(r.dob));
  addField("Driver's licence number", r.licenseNo);
  addField("Licence expiry", formatDate(r.licenseExpiry));
  addField("Government ID type", r.govIdType);
  addField("Government ID number", r.govIdNumber);
  addField("Emergency contact", `${r.emergencyName || "—"} (${r.emergencyPhone || "—"})`);

  y += 2;
  addSectionTitle("2. RENTAL AND VEHICLE CONDITION");
  addField("Vehicle", `${r.vehicleModel || VEHICLE.model}; ${r.vehicleColor || VEHICLE.color}; Plate ${r.vehiclePlate || VEHICLE.plate}`);
  addField("Pick-up date/time", formatDateTime(r.pickupDate));
  addField("Return date/time", formatDateTime(r.returnDate));
  addField("Total rental days", r.totalDays);
  // blank line for manual rent price entry
  addField("Agreed rent (PHP)", "__________________________");
  addField("Odometer out (km)", r.odometerOut);
  addField("Fuel level out", r.fuelLevelOut);
  addField("Pre-existing damage / notes", r.notes);

  y += 2;
  addSectionTitle("3. TERMS AND CONDITIONS");
  // render terms more compactly to help fit into two pages
  TERMS.forEach(([title, text]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(title, margin, y);
    y += 5;
    // use a slightly smaller paragraph font here
    addParagraph(text);
  });

  y += 2;
  addSectionTitle("4. ACKNOWLEDGEMENT");
  addParagraph(`Agreement accepted: ${String(r.agreementAccepted || "No").toUpperCase()}`);
  addParagraph("The renter's electronic submission records the acknowledgement selected on the form. This generated copy is a record of the submitted data and is not a substitute for any physical signature or legally executed deed unless separately signed and witnessed in writing.");
  addParagraph(`Record timestamp: ${r.timestamp ? formatDateTime(r.timestamp) : "Not available"}  |  Terms version: ${r.termsVersion || "1.0"}`);

  // summary and signature; ensure summary is concise to keep within two pages
  addAgreementSummary();
  addSignatureBlock();

  const safeName = String(r.fullName || "renter").replace(/[^a-z0-9_-]+/gi, "_").slice(0,50);
  doc.save(`Rental_Agreement_${safeName}_${String(r.timestamp || "").slice(0,10) || "record"}.pdf`);
}

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const key = $("adminKey").value.trim();
  if (!key) return;
  adminKey = key;
  $("loginStatus").textContent = "";
  $("gate").classList.add("hidden");
  $("dashboard").classList.remove("hidden");
  await loadRecords();
});
$("refreshBtn").addEventListener("click", loadRecords);
$("logoutBtn").addEventListener("click", () => {
  adminKey = "";
  records = [];
  $("adminKey").value = "";
  $("dashboard").classList.add("hidden");
  $("gate").classList.remove("hidden");
  $("loadStatus").textContent = "Dashboard locked.";
});
$("searchInput").addEventListener("input", renderRecords);
