# Niche Freshman Inquiries

Prep tool for weekly Niche freshman inquiry files before Slate upload.

## Source

- SFTP: `incoming/niche`
- File: `Central_Michigan_University_inquiries_YYYY_MM_DD.csv` (Mondays)
- Upload: manual/weekly

## What the tool does

1. **Split transfers** — rows with `ProspectiveType` = Transfer Student go to a separate file for Niche Transfer Inquiries
2. **Format scan** — clean names, addresses, emails
3. **Pad zeros** — ZIP (5 digits) and HighSchoolCEEB (6 digits)
4. **Fill missing HighSchoolCEEB** — bundled CEEB reference, then College Board online
5. **Export** freshman CSV + transfer split CSV

## After upload in Slate

1. Remap → Value Mappings
2. Refresh; run Retroactive Refresh if new values appear

## Run

```bash
cd ..
npm run dev
```

Open `/niche-freshman`.
