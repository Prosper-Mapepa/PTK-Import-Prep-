# College Greenlight Inquiries

Prep tool for **Appily – College Greenlight Inquiries (Cappex)** files before weekly Slate upload.

> **Contract note:** Maximum reached August 2025. No new files until July 2026.

## Source

- Format: Appily – College Greenlight Inquiries (Cappex)
- Delivery: weekly via Slate SFTP `/incoming/appily/inquiries`
- Example file: `Central_Michigan_University_169248_YYYY_MM_DD_##_##_##_greenlight.csv`

## What the tool does

1. **Format scan** — clean improper names, addresses, and emails
2. **Export** prepared CSV

No term column is rewritten for this source — only formatting cleanup.

## After upload in Slate

1. Upload the prepared CSV manually (weekly)
2. Click **Remap → Prompt Value Mappings**
3. Refresh to map any new values

## Run

```bash
cd ..   # smart-clean root
npm run dev
```

Open `/appily-greenlight`.

## Key columns

| Purpose | Header |
|---------|--------|
| Names | `first_name`, `last_name` |
| Email | `email_address` |
| Address | `address_1`, `address_2`, `city`, `state_abbr`, `zip_code` |
| Extra | `cbo_name`, `predicted_start_term`, `high_school_grad_date`, majors, CEEB |
