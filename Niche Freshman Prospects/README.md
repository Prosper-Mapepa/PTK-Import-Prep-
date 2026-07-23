# Niche Freshman Prospects

Prep tool for weekly Niche freshman prospect files before Slate upload.

## Source

- SFTP: `incoming/Niche/Prospects` (Wednesdays)
- Files (same layout):
  - `Central-Michigan-University_7f16885e-49fd-4ded-8203-f30f5db7b2f7_Prospects_Bulk_YYYY_MM_DD.csv`
  - `…_Prospects_Bulk_Cross_Interest_YYYY_MM_DD.csv` / `…_Prospects_Cross_Interest_YYYY_MM_DD.csv`
- Upload: manual/weekly

## What the tool does

1. **Format scan** — clean names, addresses, and emails
2. **Pad zeros** — ZIP (5 digits) and HighSchoolCEEB (6 digits)
3. **CMU AOI** — insert column after `MajorCIP` using the 2025 MajorCIP → AOI crosswalk
4. **Fill missing HighSchoolCEEB** — bundled CEEB reference first, then College Board online
5. **Export** prepared CSV

## After upload in Slate

1. Remap → Value Mappings
2. Refresh; run Retroactive Refresh if new values appear

## Run

```bash
cd ..
npm run dev
```

Open `/niche-prospects`.
