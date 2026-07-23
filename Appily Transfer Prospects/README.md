# Appily Transfer Prospects

Prep tool for **Appily - Transfer Prospects (Cappex)** files before monthly Slate upload.

## Source

- Format: Appily - Transfer Prospects (Cappex)
- Delivery: monthly via Slate SFTP `/incoming/appily/prospects`
- Upload: manual

## What the tool does

1. **Remove CMU students** — drop rows where `current_college_name` is Central Michigan University
2. **Format scan** — clean names, addresses, emails; pad ZIP codes with leading zeros
3. **CEEB codes** — insert `ceeb_code` after `current_college_name` and fill from reference + College Board
4. **Transfer term** — if `expected_transfer_term` is blank or in the past, set to the next Fall
5. **Export** prepared CSV

## Run

```bash
cd ..   # smart-clean root
npm run dev
```

Open `/appily-prospects`.

## Key columns

| Purpose | Header |
|---------|--------|
| Names / email | `first_name`, `last_name`, `email_address` |
| College | `current_college_name` → adds `ceeb_code` after |
| Term | `expected_transfer_term` |
| Address | `address_1`, `city`, `state_abbr`, `zip_code` |
