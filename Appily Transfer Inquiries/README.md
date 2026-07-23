# Appily Transfer Inquiries

Prep tool for **Appily - Transfer Inquiries (Cappex)** files before weekly Slate upload.

> **Contract note:** Maximum reached Nov 2025. No new files until July 2026.

## Source

- Format: Appily - Transfer Inquiries (Cappex)
- Delivery: weekly via Slate SFTP `/incoming/appily/inquiries`

## What the tool does

1. **Format scan** — clean improper names, addresses, and emails
2. **Transfer term** — fill entire `expected_transfer_term` column (column O) with the next upcoming Fall (e.g. `Fall 2026`)
3. **Export** prepared CSV

## After upload in Slate

1. Upload the prepared CSV manually (weekly)
2. Click **Remap → Prompt Value Mappings**
3. Refresh to map any new values

## Run

Use the main app landing page:

```bash
cd ..   # smart-clean root
npm run dev
```

Open `/appily-transfer`.

## Required columns

| Purpose | Header |
|---------|--------|
| Names | `first_name`, `last_name` |
| Email / address | `email_address`, `address_1`, `city`, `state_abbr`, `zip_code` (when present) |
| Transfer term | `expected_transfer_term` (column O) |
