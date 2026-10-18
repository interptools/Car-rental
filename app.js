/*
 * Customer form submission.
 * Replace APPS_SCRIPT_URL with your deployed Google Apps Script Web App URL.
 */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwrP7bc3q3AVvyuxct1kNY8HxIQBxh7tbvy2Qlvvzs4oon-3lbMtjTe2hJAwaEyTrwH/exec";

const RENTAL_TERMS = [
  ["Vehicle Details", `The rented vehicle is an MG ZS Lux 2025, black, registration plate GBJ 3556. The renter must inspect the vehicle and report any pre-existing damage before departure. The rental agreement also records the current condition, fuel level, and other agreed vehicle information before the rental begins.`],
  ["Rental Period", `The rental begins at the agreed pick-up date and time and ends at the agreed return date and time. The renter must return the vehicle on time to the agreed location. Extensions are only valid if agreed in writing and may incur additional charges.`],
  ["Fuel Policy", `The vehicle's departure fuel level is recorded on this agreement. Unless the owner agrees otherwise in writing, the renter must return the vehicle with the same fuel level. Refuelling, top-ups, and any fuel difference are subject to the agreed policy and any documented adjustment.`],
  ["Renter's Obligations", `The renter confirms that their driver's licence is valid for the rental period and must carry the licence and required vehicle documents while driving. The renter must follow all traffic laws, vehicle rules, and the owner's reasonable instructions related to the rental.`],
  ["Damage / Loss", `The renter must promptly report any collision, theft, damage, impoundment, or third-party claim and cooperate with lawful reporting and insurance procedures. Responsibility for damage and losses will be determined under the agreement and applicable law.`],
  ["Security Deposit", `Any security deposit amount, payment method, deductions, and refund timeline must be separately disclosed and agreed in writing before handover. Deductions for damage, cleaning, unpaid charges, or missing items may be applied in accordance with the agreement.`],
  ["Prohibited Use", `The vehicle must not be used for unlawful activity, racing, towing without permission, driving while impaired, carrying prohibited goods, sub-renting, or off-road use without prior approval. Any prohibited or unsafe use may void coverage and trigger additional liability.`],
  ["Return Checklist", `At return, the parties should record the return date and time, odometer reading, fuel level, visible condition and any new damage, keys and accessories returned, and any agreed charging or adjustment items before closing the agreement.`],
  ["Privacy and Recordkeeping", `The renter understands that the details submitted are used to administer the rental, contact the renter in connection with the rental, document consent, and maintain a record of the transaction and required administration.`],
];

function renderTerms() {
  const target = document.getElementById("termsPreview");
  if (!target) return;
  target.innerHTML = RENTAL_TERMS.map(([heading, body]) =>
    `<section><h3 class="font-bold text-slate-900">${escapeHtml(heading)}</h3><p class="text-slate-700">${escapeHtml(body)}</p></section>`
  ).join("");
}
function escapeHtml(value) {
  return String(value).replace(/[&<>\"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[ch]));
}
function getRentalDays() {
  const start = new Date(document.getElementById("pickupDate").value);
  const end = new Date(document.getElementById("returnDate").value);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    document.getElementById("totalDays").value = "";
    return null;
  }
  const days = Math.ceil((end - start) / 86400000);
  document.getElementById("totalDays").value = String(Math.max(1, days));
  return Math.max(1, days);
}
function collectFormData(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const nowIso = new Date().toISOString();
  data.agreementAccepted = document.getElementById("agreementAccepted").checked ? "Yes" : "No";
  data.vehicleModel = "MG ZS Lux 2025";
  data.vehiclePlate = "GBJ 3556";
  data.vehicleColor = "Black";
  data.termsVersion = "1.0";
  data.timestamp = nowIso;
  data.submittedAt = nowIso;
  return data;
}
async function submitRental(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById("formStatus");
  const button = document.getElementById("submitBtn");
  const days = getRentalDays();

  if (!form.reportValidity()) return;
  if (!days) {
    status.textContent = "Return date/time must be later than pick-up date/time.";
    status.className = "text-sm text-red-700";
    return;
  }
  if (APPS_SCRIPT_URL.includes("PASTE_YOUR")) {
    status.textContent = "Setup required: add your deployed Google Apps Script URL in app.js.";
    status.className = "text-sm text-red-700";
    return;
  }

  const payload = collectFormData(form);
  button.disabled = true;
  status.textContent = "Submitting securely to the configured endpoint…";
  status.className = "text-sm text-slate-600";
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    status.textContent = "Your submission was sent. Please contact the owner to confirm it was received.";
    status.className = "text-sm text-green-700";
    form.reset();
    document.getElementById("totalDays").value = "";
  } catch (error) {
    console.error(error);
    status.textContent = "Submission could not be sent. Check your connection or contact the owner.";
    status.className = "text-sm text-red-700";
  } finally {
    button.disabled = false;
  }
}
document.addEventListener("DOMContentLoaded", () => {
  renderTerms();
  const form = document.getElementById("rentalForm");
  form.addEventListener("submit", submitRental);
  ["pickupDate", "returnDate"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => {
      getRentalDays();
      const start = document.getElementById("pickupDate").value;
      const end = document.getElementById("returnDate").value;
      if (start && end && new Date(end) <= new Date(start)) {
        document.getElementById("returnDate").setCustomValidity("Return must be later than pick-up.");
      } else {
        document.getElementById("returnDate").setCustomValidity("");
      }
    });
  });
  const dob = document.getElementById("dob");
  dob.max = new Date().toISOString().slice(0, 10);
  const expiry = document.getElementById("licenseExpiry");
  expiry.min = new Date().toISOString().slice(0, 10);
});
