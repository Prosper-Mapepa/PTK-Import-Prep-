# Niche Transfer Prospects

Prep tool for weekly Niche transfer prospect files before Slate upload.

## Source

- SFTP: `incoming/Niche/Prospects` (Wednesdays)
- File: `Central-Michigan-University_7f16885e-49fd-4ded-8203-f30f5db7b2f7_Prospects_Transfer_YYYY_MM_DD.csv`
- Slate source format: **Niche Transfer Prospects**
- Upload: manual

## What the tool does

1. **Format scan** — clean names, emails, and mailing addresses
2. **Pad zeros** — ZIP (5 digits) and CollegeCEEB (4 digits)
3. **CMU AOI** — insert column after `MajorCIP` using the MajorCIP → AOI crosswalk
4. **Fill missing CollegeCEEB** — bundled CEEB reference (`CEEB codes frequently missing.xlsx`), then College Board online
5. **IntendedTransferDate** — update when blank or in the past → next Fall start (`8/1/YYYY`)
6. **Export** prepared CSV

## After upload in Slate

1. Remap → Value Mappings
2. Refresh; run Retroactive Refresh if new values appear

## Run

```bash
cd ..
npm run dev
```

Open `/niche-transfer-prospects`.
