# Appily Freshman Inquiries

Step-by-step prep tool for **Appily – Freshmen Inquiries (Cappex)** files before Slate upload.

## What it does

1. **Upload** the Cappex CSV  
   File pattern: `Central_Michigan_University_169248_YYYY_MM_DD_##_##_##_cappex.csv`
2. **Format scan** — cleans improper names (accents), addresses, and email typos
3. **Start term** — sets `predicted_start_term` to **Fall {year}** from `high_school_grad_date`  
   Example: `6/1/2027` → `Fall 2027`
4. **Export** a Slate-ready CSV

## Setup

```bash
cd "Appily Freshman Inquiries"
npm install
npm run dev
```

If disk space is tight, you can symlink the parent project’s `node_modules` instead of installing again:

```bash
ln -s ../node_modules ./node_modules
npm run dev
```

Open the local URL shown in the terminal (usually `http://localhost:5173`).

A sample file is in `sample/` for a quick test.

## Required columns

The file must include (names may vary slightly):

| Purpose | Cappex header |
|---------|----------------|
| First name | `first_name` |
| Last name | `last_name` |
| Email | `email_address` |
| Address | `address_1`, `address_2`, `city`, `state_abbr`, `zip_code` |
| HS grad date | `high_school_grad_date` |
| Predicted start term | `predicted_start_term` |

## Slate upload

After export, upload the CSV manually in Slate using the **Appily - Freshmen Inquiries (Cappex)** source format.
