/*
 * Owner dashboard and client-side PDF generation.
 * Configure APPS_SCRIPT_URL to the same deployed Web App URL used by app.js.
 * The dashboard key is entered by the owner at runtime; it is not stored in this file.
 */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwrP7bc3q3AVvyuxct1kNY8HxIQBxh7tbvy2Qlvvzs4oon-3lbMtjTe2hJAwaEyTrwH/exec";
const VEHICLE = { model: "MG ZS Lux 2025", plate: "GBJ 3556", color: "Black" };
const TERMS = [
  ["Vehicle Details", "The rented vehicle is an MG ZS Lux 2025, black, registration plate GBJ 3556. The renter must inspect the vehicle and report pre-existing damage before departure. The renter must keep the vehicle secure and use it with reasonable care."],
  ["Rental Period", "The rental begins at the agreed pick-up date and time and ends at the agreed return date and time. The renter must return the vehicle on time to the agreed location. Extensions require the owner's prior approval and may incur additional charges under the separately agreed rate."],
  ["Fuel Policy", "The vehicle's departure fuel level is recorded on this agreement. Unless the owner agrees otherwise in writing, the renter must return the vehicle with the same fuel level. Refuelling or service charges, if applicable, must be disclosed and agreed by the parties."],
  ["Renter's Obligations", "The renter confirms that their driver's licence is valid for the rental period and must carry the licence and required vehicle documents while driving. The renter must obey traffic laws, use seat belts, take reasonable precautions against theft, and promptly notify the owner of accidents, breakdowns, damage, or loss. The renter must not allow an unauthorized driver to operate the vehicle."],
  ["Damage / Loss", "The renter must promptly report any collision, theft, damage, impoundment, or third-party claim and cooperate with lawful reporting and insurance procedures. Responsibility for loss, damage, deductibles, towing, or third-party claims depends on the facts, applicable law, insurance terms, and any separately signed written terms; this template does not create an automatic finding of liability."],
  ["Security Deposit", "Any security deposit amount, payment method, deductions, and refund timeline must be separately disclosed and agreed in writing before handover. No deposit amount is specified by this form. Deductions should be itemized and supported by reasonable records, subject to applicable law."],
  ["Prohibited Use", "The vehicle must not be used for unlawful activity, racing, towing without permission, driving while impaired, carrying prohibited goods, sub-renting, or off-road use without the owner's written consent. The renter must not remove, tamper with, or disable safety or tracking equipment."],
  ["Return Checklist", "At return, the parties should record the return date and time, odometer reading, fuel level, visible condition and any new damage, keys and accessories returned, and any agreed charges. Both parties should retain a copy of the completed condition record."],
  ["Privacy and Recordkeeping", "The renter understands that the details submitted are used to administer the rental, contact the renter in connection with the rental, document consent, and maintain business records. The owner should restrict access, secure the spreadsheet, retain information only as necessary, and comply with applicable privacy and data-protection requirements."]
];

let adminKey = "";
let records = [];

const $ = id => document.getElementById(id);
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function fmt(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}
function period(record) {
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
      <td><span class="rounded-full px-2 py-1 text-xs ${String(r.agreementAccepted).toLowerCase()==="yes"?"bg-green-100 text-green-800":"bg-red-100 text-red-800"}">${escapeHtml(r.agreementAccepted || "No")}</span></td>
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
  const margin = 17;
  const maxWidth = pageWidth - margin * 2;
  let y = 18;

  function ensureSpace(required = 14) {
    if (y + required > pageHeight - 17) {
      doc.addPage();
      y = 18;
    }
  }
  function heading(text) {
    ensureSpace(12);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text(text, margin, y); y += 6;
    doc.setDrawColor(203, 213, 225); doc.line(margin, y - 2, pageWidth - margin, y - 2);
  }
  function field(label, value) {
    ensureSpace(10);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text(`${label}:`, margin, y);
    doc.setFont("helvetica", "normal");
    const labelWidth = Math.min(doc.getTextWidth(`${label}:`) + 2, 45);
    const lines = doc.splitTextToSize(String(value || "—"), maxWidth - labelWidth);
    doc.text(lines, margin + labelWidth, y);
    y += Math.max(5, lines.length * 4.5);
  }
  function paragraph(text) {
    const lines = doc.splitTextToSize(text, maxWidth);
    ensureSpace(lines.length * 4.5 + 3);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    doc.text(lines, margin, y);
    y += lines.length * 4.2 + 3;
  }

  doc.setFillColor(15, 23, 42); doc.rect(0, 0, pageWidth, 36, "F");
  doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(17);
  doc.text("VEHICLE RENTAL AGREEMENT", margin, 16);
  doc.setFont("helvetica","normal"); doc.setFontSize(10);
  doc.text(`${VEHICLE.model}  |  Plate ${VEHICLE.plate}  |  ${VEHICLE.color}`, margin, 25);
  doc.setTextColor(30,41,59); y = 45;

  heading("1. RENTER INFORMATION");
  [
    ["Full legal name",r.fullName],["Contact number",r.contact],["Address",r.address],["Email",r.email],
    ["Date of birth",r.dob],["Driver's licence number",r.licenseNo],["Licence expiry",r.licenseExpiry],
    ["Government ID type",r.govIdType],["Government ID number",r.govIdNumber],
    ["Emergency contact",`${r.emergencyName || "—"} (${r.emergencyPhone || "—"})`]
  ].forEach(([a,b]) => field(a,b));

  y += 2; heading("2. RENTAL AND VEHICLE CONDITION");
  [
    ["Vehicle",`${r.vehicleModel || VEHICLE.model}; ${r.vehicleColor || VEHICLE.color}; Plate ${r.vehiclePlate || VEHICLE.plate}`],
    ["Pick-up date/time",r.pickupDate],["Return date/time",r.returnDate],["Total rental days",r.totalDays],
    ["Odometer out (km)",r.odometerOut],["Fuel level out",r.fuelLevelOut],["Pre-existing damage / notes",r.notes]
  ].forEach(([a,b]) => field(a,b));

  y += 2; heading("3. TERMS AND CONDITIONS");
  TERMS.forEach(([title, text]) => {
    ensureSpace(15);
    doc.setFont("helvetica","bold"); doc.setFontSize(9);
    doc.text(title, margin, y); y += 4.5;
    paragraph(text);
  });

  y += 1; heading("4. ACKNOWLEDGEMENT");
  paragraph(`Agreement accepted: ${String(r.agreementAccepted || "No").toUpperCase()}`);
  paragraph("The renter's electronic submission records the acknowledgement selected on the form. This generated copy is a record of the submitted data and is not a substitute for any signature or additional document required by law or agreed by the parties.");
  paragraph(`Record timestamp: ${r.timestamp || "Not available"}  |  Terms version: ${r.termsVersion || "1.0"}`);

  ensureSpace(35);
  y += 5;
  doc.setFont("helvetica","normal"); doc.setFontSize(9);
  doc.line(margin, y + 10, margin + 72, y + 10);
  doc.line(pageWidth - margin - 72, y + 10, pageWidth - margin, y + 10);
  doc.text("Renter signature / date", margin, y + 15);
  doc.text("Owner / representative signature / date", pageWidth - margin - 72, y + 15);

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(100,116,139);
    doc.text(`Rental agreement · ${VEHICLE.plate}`, margin, pageHeight - 8);
    doc.text(`Page ${i} of ${pages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
  }
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
