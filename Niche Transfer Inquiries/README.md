# Niche Transfer Inquiries

Prep tool for weekly Niche transfer inquiry files before Slate upload.

## Source

- SFTP: `incoming/niche`
- File: `Central_Michigan_University_Transfer_inquiries_YYYY_MM_DD.csv` (Mondays)
- Upload: manual/weekly

## What the tool does

1. **Remove CMU** — drop rows where `CollegeName` is Central Michigan University
2. **Format scan** — clean names, addresses, emails
3. **Pad zeros** — ZIP (5 digits) and CollegeCEEB (4 digits)
4. **Fill missing CollegeCEEB** — bundled CEEB reference, then College Board online
5. **TransferEnrollmentDate** — update if blank, in the past, or more than 2 years in the future → next Fall start (`8/1/YYYY`)
6. **Export** prepared CSV

## After upload in Slate

1. Remap → Value Mappings
2. Refresh; run Retroactive Refresh if new values appear

## Run

```bash
cd ..
npm run dev
```

Open `/niche-transfer`.
