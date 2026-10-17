# Car Rental Agreement System

A static customer form and owner dashboard for the **MG ZS Lux 2025**, **Black**, plate **GBJ 3556**. The frontend uses HTML, Tailwind CSS CDN, vanilla JavaScript, and jsPDF. Google Apps Script writes submissions to Google Sheets.

## Files

- `index.html` — public renter form and terms preview
- `app.js` — form validation and submission
- `dashboard.html` — owner dashboard
- `dashboard.js` — records table, search, and client-side PDF generation
- `google-apps-script.js` — Google Sheets backend; paste into Apps Script as `Code.gs`

## 1. Create the Google Sheet

1. Create a new Google Sheet.
2. Copy the spreadsheet ID from its URL. It is the part between `/d/` and `/edit`.
3. Open **Extensions → Apps Script**.
4. Replace the starter code with the contents of `google-apps-script.js`.
5. Open **Project Settings → Script Properties** and add these properties:
   - `SPREADSHEET_ID` — your spreadsheet ID
   - `ADMIN_KEY` — a long, random secret used only for dashboard record retrieval. Use a password manager to create it; do not reuse your Google password.
6. Save the project.

The script creates a `Rental Records` tab and its header row automatically on the first request.

## 2. Deploy the Apps Script Web App

1. In Apps Script, click **Deploy → New deployment**.
2. Select **Web app**.
3. Set **Execute as** to **Me**.
4. Set **Who has access** to **Anyone** if you want the public GitHub Pages form to submit without customer Google sign-in.
5. Deploy and authorize the script when prompted.
6. Copy the deployed URL ending in `/exec`. Do not use a development `/dev` URL for the live site.

**Important:** a public endpoint can be called by anyone, not only by your form. The script validates required fields and consent, but it is not an anti-spam service. If public submissions become abused, add stronger controls or use an authenticated backend.

## 3. Configure the frontend

Open `app.js` and `dashboard.js`. In each file, replace:

```js
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwrP7bc3q3AVvyuxct1kNY8HxIQBxh7tbvy2Qlvvzs4oon-3lbMtjTe2hJAwaEyTrwH/exec";
```

with your deployed `/exec` URL. Use the same URL in both files.

The owner enters the `ADMIN_KEY` value at runtime on `dashboard.html`. The key is not saved in local storage or hardcoded in the public JavaScript files.

## 4. Test before publishing

1. Open `index.html` locally or through a temporary GitHub Pages deployment.
2. Complete every required field, set a return time after pick-up, and tick the agreement checkbox.
3. Submit the form.
4. Check that a row appears in `Rental Records`.
5. Open `dashboard.html`, enter the `ADMIN_KEY`, and confirm the record loads.
6. Click **Download Agreement PDF** and inspect the downloaded PDF.

### Cross-origin note

The customer form sends a `text/plain` POST with `mode: "no-cors"` because browser CORS restrictions can prevent the page from reading Apps Script's response. The browser cannot verify the backend result in this mode; the success message means the request was sent, not that the row was confirmed. Always test the spreadsheet. The dashboard uses a JSONP callback for cross-origin record retrieval. The dashboard key is sent as a URL parameter, so it can appear in browser/network history and server logs; do not share the dashboard URL or key. For higher-security deployments, use a proper authenticated backend instead of JSONP/shared-key access.

## 5. Publish on GitHub Pages

1. Create a GitHub repository, for example `car-rental-agreement`.
2. Upload all five application files plus this README to the repository root.
3. Open **Settings → Pages**.
4. Under build and deployment, choose **Deploy from a branch**.
5. Select the `main` branch and `/ (root)`, then save.
6. Wait for GitHub Pages to publish. The customer form is usually at `https://interptools.github.io/Car-rental/`; the dashboard is `https://interptools.github.io/Car-rental/dashboard.html`.

GitHub Pages is public hosting. Do not put passwords, private keys, customer data, or other secrets in the repository.

## 6. Security and privacy checklist

- The dashboard key is a shared-secret gate, not full user authentication. The Apps Script checks the key before returning records, but anyone who obtains the key can access the records.
- The submission endpoint is public if configured for unauthenticated public form use. It can receive forged or spam requests. Do not treat browser-side validation as a security boundary.
- The sheet contains personal information, date of birth, driver's licence number, and government ID number. Limit Google Sheet sharing to the people who need it, use a dedicated Google account, enable multi-factor authentication, and review access periodically.
- Consider whether collecting a full government ID number and date of birth is necessary. Collect and retain only what you need.
- Publish an appropriate privacy notice and retention/deletion policy, and review applicable Philippine Data Privacy Act requirements with a qualified professional.
- This is a starter agreement template, not legal advice. Have a Philippine lawyer review the rental terms, insurance, deposit, damage responsibility, privacy notice, and electronic-consent process before relying on it commercially.
- The form records checkbox consent and a timestamp, but does not collect a drawn signature or cryptographic proof of the exact terms shown at submission.
- The terms mention no fixed rental price, security deposit amount, mileage allowance, late fee, or payment schedule because those values were not supplied. Add agreed terms before using this for real rentals.

## Troubleshooting

- **No row appears:** verify the `/exec` URL, script deployment, authorization, and `SPREADSHEET_ID` property. Check Apps Script **Executions** for errors.
- **Dashboard says unauthorized:** confirm `ADMIN_KEY` in Script Properties matches what you enter, without extra spaces.
- **Dashboard cannot load records:** check the deployed URL and Apps Script deployment access settings. Open the browser developer console for network errors.
- **PDF button does nothing:** ensure internet access is available for the jsPDF CDN. The PDF library is not bundled locally.
- **After editing Apps Script:** create a new deployment version or update the existing deployment so `/exec` serves the latest code.

## Data columns

The sheet records `Timestamp`, all renter fields, rental dates, calculated days, odometer and fuel at departure, pre-existing damage notes, `Agreement Accepted`, vehicle model, plate, color, and terms version.
