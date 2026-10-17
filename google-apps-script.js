/*
 * Google Apps Script backend for the Car Rental Agreement system.
 *
 * Setup:
 * 1) Create a Google Sheet and copy its spreadsheet ID.
 * 2) Open Extensions > Apps Script and paste this file into Code.gs.
 * 3) In Project Settings > Script Properties, add:
 *      SPREADSHEET_ID = your spreadsheet ID
 *      ADMIN_KEY = a long, random dashboard secret (not the Google password)
 * 4) Deploy > New deployment > Web app.
 *    Execute as: Me
 *    Who has access: Anyone (required for a public GitHub Pages form).
 * 5) Copy the /exec URL into app.js and dashboard.js.
 *
 * Security note: Anyone can POST to a public endpoint. Do not store more sensitive
 * data than necessary. For production, consider an authenticated backend and
 * stronger abuse protection. The ADMIN_KEY protects list retrieval only.
 */

const HEADERS = [
  "Timestamp","Full Name","Contact","Address","Email","Date of Birth",
  "Driver License No.","License Expiry","Government ID Type","Government ID Number",
  "Emergency Contact Name","Emergency Contact Number","Pick-up Date","Return Date",
  "Total Days","Odometer Out","Fuel Level Out","Pre-existing Damage / Notes",
  "Agreement Accepted","Vehicle Model","Vehicle Plate","Vehicle Color","Terms Version"
];

function getConfig_() {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty("SPREADSHEET_ID");
  const adminKey = props.getProperty("ADMIN_KEY");
  if (!spreadsheetId) throw new Error("Missing SPREADSHEET_ID script property.");
  if (!adminKey) throw new Error("Missing ADMIN_KEY script property.");
  return { spreadsheetId, adminKey };
}
function getSheet_() {
  const { spreadsheetId } = getConfig_();
  const ss = SpreadsheetApp.openById(spreadsheetId);
  let sheet = ss.getSheetByName("Rental Records");
  if (!sheet) sheet = ss.insertSheet("Rental Records");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  }
  return sheet;
}
function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents;
    if (!raw) return json_({ ok: false, error: "Empty request body." });
    const data = JSON.parse(raw);
    const required = [
      "fullName","contact","address","email","dob","licenseNo","licenseExpiry",
      "govIdType","govIdNumber","emergencyName","emergencyPhone","pickupDate",
      "returnDate","totalDays","odometerOut","fuelLevelOut"
    ];
    const missing = required.filter(k => !String(data[k] ?? "").trim());
    if (missing.length) return json_({ ok: false, error: "Missing required fields: " + missing.join(", ") });
    if (String(data.agreementAccepted) !== "Yes") {
      return json_({ ok: false, error: "Agreement acceptance is required." });
    }
    const start = new Date(data.pickupDate);
    const end = new Date(data.returnDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return json_({ ok: false, error: "Invalid rental period." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email))) {
      return json_({ ok: false, error: "Invalid email address." });
    }

    const sheet = getSheet_();
    const row = [
      new Date(), safeCell_(data.fullName), safeCell_(data.contact), safeCell_(data.address),
      safeCell_(data.email), safeCell_(data.dob), safeCell_(data.licenseNo),
      safeCell_(data.licenseExpiry), safeCell_(data.govIdType), safeCell_(data.govIdNumber),
      safeCell_(data.emergencyName), safeCell_(data.emergencyPhone), safeCell_(data.pickupDate),
      safeCell_(data.returnDate), Number(data.totalDays), Number(data.odometerOut),
      safeCell_(data.fuelLevelOut), safeCell_(data.notes || ""),
      "Yes", "MG ZS Lux 2025", "GBJ 3556", "Black", safeCell_(data.termsVersion || "1.0")
    ];
    sheet.appendRow(row);
    return json_({ ok: true, message: "Rental record saved." });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err.message || err) });
  }
}
function doGet(e) {
  const params = (e && e.parameter) || {};
  const callback = String(params.callback || "");
  const wantsJsonp = /^[A-Za-z_$][0-9A-Za-z_$]{0,80}$/.test(callback);
  try {
    if (params.action !== "list") {
      return output_({ ok: true, message: "Car rental agreement API is running." }, wantsJsonp ? callback : "");
    }
    const { adminKey } = getConfig_();
    if (!constantTimeEquals_(String(params.key || ""), adminKey)) {
      return output_({ ok: false, error: "Unauthorized." }, wantsJsonp ? callback : "");
    }
    const sheet = getSheet_();
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return output_({ ok: true, records: [] }, wantsJsonp ? callback : "");
    const headers = values[0].map(String);
    const records = values.slice(1).filter(row => row.some(v => v !== "")).map(row => {
      const obj = {};
      headers.forEach((header, i) => obj[header] = row[i] instanceof Date ? row[i].toISOString() : row[i]);
      return {
        timestamp: obj["Timestamp"], fullName: obj["Full Name"], contact: obj["Contact"],
        address: obj["Address"], email: obj["Email"], dob: obj["Date of Birth"],
        licenseNo: obj["Driver License No."], licenseExpiry: obj["License Expiry"],
        govIdType: obj["Government ID Type"], govIdNumber: obj["Government ID Number"],
        emergencyName: obj["Emergency Contact Name"], emergencyPhone: obj["Emergency Contact Number"],
        pickupDate: obj["Pick-up Date"], returnDate: obj["Return Date"], totalDays: obj["Total Days"],
        odometerOut: obj["Odometer Out"], fuelLevelOut: obj["Fuel Level Out"],
        notes: obj["Pre-existing Damage / Notes"], agreementAccepted: obj["Agreement Accepted"],
        vehicleModel: obj["Vehicle Model"], vehiclePlate: obj["Vehicle Plate"],
        vehicleColor: obj["Vehicle Color"], termsVersion: obj["Terms Version"]
      };
    });
    return output_({ ok: true, records: records }, wantsJsonp ? callback : "");
  } catch (err) {
    console.error(err);
    return output_({ ok: false, error: String(err.message || err) }, wantsJsonp ? callback : "");
  }
}
function safeCell_(value) {
  // Prevent spreadsheet formula injection from user-supplied strings.
  const text = String(value == null ? "" : value).slice(0, 5000);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}
function constantTimeEquals_(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function output_(data, callback) {
  const serialized = JSON.stringify(data);
  if (callback) {
    // The callback is restricted to identifier characters above.
    return ContentService.createTextOutput(callback + "(" + serialized + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(data);
}
