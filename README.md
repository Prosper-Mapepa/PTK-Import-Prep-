# PTK Slate Import Prep

A simple step-by-step app for preparing Phi Theta Kappa (PTK) import files before manual upload to Slate (Technolutions).

## What it does

### Main Campus
1. Spot check and clean addresses
2. Fill missing CEEB codes (Excel reference, then College Board online) and pad to four digits
3. Add **CMU AOI** after **Current Major Code** (2025 MajorCIP to AOI crosswalk)
4. Add **Start Term** after **Expected Graduation Date** (from the file name)
5. Export prepared CSV

### Global Campus (Online)
1. Spot check and clean addresses
2. Fill missing CEEB codes and pad to four digits
3. Export prepared CSV

### CEEB codes
1. Looks up missing codes in the bundled Excel reference (exact + fuzzy match)
2. Searches College Board online for any still missing (via `npm run dev` or `npm run preview`)
3. Pads all codes to four digits; treats 5+ digit values as invalid (often IPEDS, not CEEB)
4. Use **Rerun CEEB search** on the CEEB step to retry Excel + online lookup

Online CEEB search requires running the app locally so the built-in search API can reach College Board.

## Setup

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal (usually `http://localhost:5173`).

## Files you need

- Monthly PTK import file (CSV or Excel). The file name should include `MAIN CAMPUS` or `ONLINE`.

Reference files are bundled in `public/reference/`:
- `CEEB codes frequently missing.xlsx`
- `2025 MajorCIP to AOI crosswalk.xlsx`

## Slate upload

After export, upload the CSV manually in Slate using:
- **PTK Import – Main Campus**, or
- **PTK Import – Global Campus**

## CEEB code lookups

- [High school CEEB search](https://satsuite.collegeboard.org/k12-educators/tools-resources/k12-school-code-search)
- [College CEEB search](https://www.suny.edu/attend/ceeb-codes/search_colleges/)
