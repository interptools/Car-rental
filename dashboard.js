/*
 * Owner dashboard and client-side PDF generation.
 * Configure APPS_SCRIPT_URL to the same deployed Web App URL used by app.js.
 * The dashboard key is entered by the owner at runtime; it is not stored in this file.
 */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwrP7bc3q3AVvyuxct1kNY8HxIQBxh7tbvy2Qlvvzs4oon-3lbMtjTe2hJAwaEyTrwH/exec";
const VEHICLE = { model: "MG ZS Lux 2025", plate: "GBJ 3556", color: "Black" };
const PH_TIMEZONE = "Asia/Manila";
const TERMS = [
  ["Vehicle Details", "The rented vehicle is an MG ZS Lux 2025, black, registration plate GBJ 3556. The renter must inspect the vehicle and report any pre-existing damage before departure. The renter must not use the vehicle for any purpose other than the agreed rental use and must comply with local traffic law and the rental agreement."],
  ["Rental Period", "The rental begins at the agreed pick-up date and time and ends at the agreed return date and time. The renter must return the vehicle on time to the agreed location. Extensions require prior written approval from the owner and may incur additional charges."],
  ["Fuel Policy", "The vehicle's departure fuel level is recorded on this agreement. Unless the owner agrees otherwise in writing, the renter must return the vehicle with the same fuel level. Refuelling is the renter's responsibility unless stated otherwise."],
  ["Renter's Obligations", "The renter confirms that their driver's licence is valid for the rental period and must carry the licence and required vehicle documents while driving. The renter must obey traffic laws, maintain safe driving standards, and ensure all occupants are properly seated and secured."],
  ["Damage / Loss", "The renter must promptly report any collision, theft, damage, impoundment, or third-party claim and cooperate with lawful reporting and insurance procedures. Responsibility for loss, damage, or third-party claims will be determined in line with the agreement and applicable law."],
  ["Security Deposit", "Any security deposit amount, payment method, deductions, and refund timeline must be separately disclosed and agreed in writing before handover. Deductions for damage, cleaning, or unpaid charges will be applied only as agreed."],
  ["Prohibited Use", "The vehicle must not be used for unlawful activity, racing, towing without permission, driving while impaired, carrying prohibited goods, sub-renting, or off-road use without the owner's explicit written approval."],
  ["Return Checklist", "At return, the parties should record the return date and time, odometer reading, fuel level, visible condition and any new damage, keys and accessories returned, and any agreed charges or deductions."],
  ["Privacy and Recordkeeping", "The renter understands that the details submitted are used to administer the rental, contact the renter in connection with the rental, document consent, and maintain business records required for the rental relationship."]
];

let adminKey = "";
let records = [];

const $ = id => document.getElementById(id);

function parseRecordTimestamp(value) {
  if (value === undefined || value === null || value === "") return null;

  // If it's numeric string, convert
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    value = Number(value.trim());
  }

  // If it's a number, treat as epoch (seconds or ms)
  if (typeof value === "number") {
    const ms = value > 1e12 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string") {
    const s = value.trim();
    // Detect timezone-less local datetime like "YYYY-MM-DDTHH:mm" or with seconds
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(?:\.\d+)?$/.test(s)) {
      // Assume Asia/Manila local time and append offset +08:00
      value = s + ":00+08:00".replace(":00+08:00+08:00", ":00+08:00");
      // Above replace guards against double-adding if seconds present; but simple append is fine
    }
    // If string has no explicit timezone, Date will treat accordingly in some environments, so we ensure offset appended above.
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, ch => ({"&":"&amp;","<":"&lt;","}":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
}

function fmt(value) {
  const date = parseRecordTimestamp(value);
  if (!date) return "—";
  return date.toLocaleString('en-PH', { timeZone: PH_TIMEZONE });
}

function formatDate(value) {
  const date = parseRecordTimestamp(value);
  if (!date) return "—";
  return date.toLocaleDateString('en-PH', {
    timeZone: PH_TIMEZONE,
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function formatDateTime(value) {
  const date = parseRecordTimestamp(value);
  if (!date) return "—";
  const datePart = date.toLocaleDateString('en-PH', {
    timeZone: PH_TIMEZONE,
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  const timePart = date.toLocaleTimeString('en-PH', {
    timeZone: PH_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
  return `${datePart} at ${timePart}`;
}

function period(record) {
  return `${formatDateTime(record.pickupDate) || "—"} → ${formatDateTime(record.returnDate) || "—"}`;
}

function parseTermsToArray(terms) {
  if (!terms) return TERMS;
  if (Array.isArray(terms)) return terms;
  if (typeof terms === "string") {
    try {
      const parsed = JSON.parse(terms);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // ignore JSON parse failure and use single entry fallback below
    }
    return [["Terms and Conditions", terms]];
  }
  return TERMS;
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
    status.textContent = `Loaded ${records.length} record(s) at ${new Date().toLocaleString('en-PH', { timeZone: PH_TIMEZONE })}.`;
  } catch (error) {
    console.error(error);
    status.textContent = "Could not load records. Verify the Apps Script URL, deployment permissions, dashboard key, and browser console.";
  }
}

function requestRecordsJsonp() {
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
  const filtered = records.filter(r => [r.fullName, r.contact, r.email, r.vehiclePlate, r.licenseNo].some(v => String(v || "").toLowerCase().includes(query)));
  $("totalRecords").textContent = records.length;
  $("acceptedCount").textContent = records.filter(r => String(r.agreementAccepted).toLowerCase() === "yes").length;
  $("latestRecord").textContent = records.length ? fmt(records[records.length - 1].timestamp || records[records.length - 1].submittedAt || records[records.length - 1].createdAt || records[records.length - 1].recordedAt) : "—";
  const body = $("recordsBody");
  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="8" class="text-slate-500">${records.length ? "No records match your search." : "No records found."}</td></tr>`;
    return;
  }
  body.innerHTML = filtered.map(r => {
    const index = records.indexOf(r);
    const ts = r.timestamp || r.submittedAt || r.createdAt || r.recordedAt;
    return `<tr>
      <td>${escapeHtml(fmt(ts))}</td>
      <td><strong>${escapeHtml(r.fullName || "—")}</strong><div class="text-xs text-slate-500">${escapeHtml(r.email || "")}</div></td>
      <td>${escapeHtml(r.contact || "—")}</td>
      <td>${escapeHtml(period(r))}</td>
      <td>${escapeHtml(r.totalDays || "—")}</td>
      <td>${escapeHtml(r.vehicleModel || VEHICLE.model)}<div class="text-xs text-slate-500">${escapeHtml(r.vehiclePlate || VEHICLE.plate)} · ${escapeHtml(r.vehicleColor || VEHICLE.color)}</div></td>
      <td><span class="rounded-full px-2 py-1 text-xs ${String(r.agreementAccepted).toLowerCase()==="yes"?"bg-green-100 text-green-800":"bg-red-100 text-red-800"}">${escapeHtml(String(r.agreementAccepted || "No").toUpperCase())}</span></td>
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
  const margin = 14;
  const maxWidth = pageWidth - margin * 2;
  const labelWidth = 56;
  let y = 18;

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

  function getRecordTimestamp(record) {
    return record.timestamp || record.submittedAt || record.createdAt || record.recordedAt;
  }

  function addAgreementSummary() {
    const termVersion = String(r.termsVersion || "1.0");
    const recTime = getRecordTimestamp(r);
    addSectionTitle("5. COMPLETE AGREEMENT SUMMARY");
    addParagraph(`This rental agreement is for ${r.vehicleModel || VEHICLE.model}, ${r.vehicleColor || VEHICLE.color}, plate ${r.vehiclePlate || VEHICLE.plate}. The renter, ${r.fullName || "—"} ...`);
    addParagraph(`Rental period: ${formatDateTime(r.pickupDate)} to ${formatDateTime(r.returnDate)} (${r.totalDays || "—"} day(s)). Odometer out: ${r.odometerOut || "—"} km. Fuel level out: ${r.fuelLevelOut || "—"}.`);
    addParagraph(`Contact details: ${r.contact || "—"}; Address: ${r.address || "—"}; Email: ${r.email || "—"}. Emergency contact: ${r.emergencyName || "—"} (${r.emergencyPhone || "—"}).`);
    addParagraph(`Driver's licence: ${r.licenseNo || "—"}; expiry ${formatDate(r.licenseExpiry)}. Government ID: ${r.govIdType || "—"} ${r.govIdNumber || "—"}.`);
    addParagraph(`Pre-existing damage / notes: ${r.notes || "No additional notes recorded."}`);
    addParagraph(`Agreed rent (PHP): ${r.agreedRent || "__________________________"}`);
    addParagraph(`Agreement accepted: ${String(r.agreementAccepted || "No").toUpperCase()}. Record timestamp: ${formatDateTime(recTime)}. Terms version: ${termVersion}`);
  }

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("VEHICLE RENTAL AGREEMENT", margin, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${r.vehicleModel || VEHICLE.model} | Plate ${r.vehiclePlate || VEHICLE.plate} | ${r.vehicleColor || VEHICLE.color}`, margin, 26);
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
  addField("Agreed rent (PHP)", r.agreedRent || "__________________________");
  addField("Odometer out (km)", r.odometerOut);
  addField("Fuel level out", r.fuelLevelOut);
  addField("Pre-existing damage / notes", r.notes);

  y += 2;
  addSectionTitle("3. TERMS AND CONDITIONS");
  const termsToRender = parseTermsToArray(r.terms || r.termsText || r.termsJSON || null);
  termsToRender.forEach(([title, text]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(title, margin, y);
    y += 5;
    addParagraph(text);
  });

  y += 2;
  addSectionTitle("4. ACKNOWLEDGEMENT");
  addParagraph(`Agreement accepted: ${String(r.agreementAccepted || "No").toUpperCase()}`);
  addParagraph("The renter's electronic submission records the acknowledgement selected on the form. This generated copy is a record of the submitted data and is not a substitute for any physical copy or proof of vehicle handover.");
  addParagraph(`Record timestamp: ${formatDateTime(getRecordTimestamp(r))}  |  Terms version: ${String(r.termsVersion || "1.0")}`);

  addAgreementSummary();
  addSignatureBlock();

  const safeName = String(r.fullName || "renter").replace(/[^a-z0-9_-]+/gi, "_").slice(0, 50);
  const tsValue = getRecordTimestamp(r);
  const fileDate = parseRecordTimestamp(tsValue) ? parseRecordTimestamp(tsValue).toLocaleDateString('en-CA', { timeZone: PH_TIMEZONE }) : "record";
  doc.save(`Rental_Agreement_${safeName}_${fileDate}.pdf`);
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
