# CMU Slate File Prep

Landing hub for preparing inquiry files before manual upload to Slate (Technolutions).

## Categories

| Route | Tool | Source |
|-------|------|--------|
| `/` | Landing page | — |
| `/ptk` | **PTK Import Prep** | Phi Theta Kappa (Team Dynamix) |
| `/appily` | **Appily Freshman Inquiries** | Appily / Cappex freshmen |
| `/appily-transfer` | **Appily Transfer Inquiries** | Appily / Cappex transfers (SFTP weekly) |
| `/appily-greenlight` | **College Greenlight Inquiries** | Appily / Cappex Greenlight (SFTP weekly) |
| `/appily-prospects` | **Appily Transfer Prospects** | Appily / Cappex prospects (SFTP monthly) |
| `/niche-freshman` | **Niche Freshman Inquiries** | Niche (SFTP incoming/niche, weekly) |
| `/niche-transfer` | **Niche Transfer Inquiries** | Niche Transfer (SFTP incoming/niche, weekly) |

### PTK Import Prep (`/ptk`)
- Clean addresses, names, and emails
- Fill missing CEEB codes and pad to four digits
- Main campus: add CMU AOI and Start Term
- Export Slate-ready CSV

### Appily Freshman Inquiries (`/appily`)
- Scan/fix names, addresses, and emails
- Set `predicted_start_term` from `high_school_grad_date` (e.g. `6/1/2027` → `Fall 2027`)
- Export Slate-ready Cappex CSV

### Appily Transfer Inquiries (`/appily-transfer`)
- Scan/fix names, addresses, and emails
- Fill entire `expected_transfer_term` column with the next upcoming Fall
- After Slate upload: Remap → Prompt Value Mappings
- Contract note: files paused Nov 2025 – Jul 2026

### College Greenlight Inquiries (`/appily-greenlight`)
- Scan/fix names, addresses, and emails
- After Slate upload: Remap → Prompt Value Mappings
- Contract note: files paused Aug 2025 – Jul 2026

### Appily Transfer Prospects (`/appily-prospects`)
- Remove students currently at Central Michigan University
- Scan/fix names, addresses, emails; pad ZIP codes
- Add `ceeb_code` after `current_college_name` and fill CEEB codes
- Fix blank/past `expected_transfer_term` → next Fall
- Manual monthly upload

### Niche Freshman Inquiries (`/niche-freshman`)
- Split `ProspectiveType` = Transfer Student into a separate file
- Scan/fix names, addresses, emails; pad ZIP and HighSchoolCEEB zeros
- Fill missing HighSchoolCEEB (reference + College Board)
- After upload: Remap → Value Mappings; Retroactive Refresh if needed

### Niche Transfer Inquiries (`/niche-transfer`)
- Remove students with `CollegeName` = Central Michigan University
- Scan/fix names, addresses, emails; pad ZIP and CollegeCEEB zeros
- Fill missing CollegeCEEB (reference + College Board)
- Fix `TransferEnrollmentDate` when blank, past, or more than 2 years out → next Fall start
- After upload: Remap → Value Mappings; Retroactive Refresh if needed

## Setup

```bash
npm install
npm run dev
```

Open the local URL (usually `http://localhost:5173`).

## Slate upload

Upload the exported CSV manually in Slate using the matching source format:
- **PTK Import – Main Campus** / **Global Campus**
- **Appily - Freshmen Inquiries (Cappex)**
- **Appily - Transfer Inquiries (Cappex)**
- **Appily – College Greenlight Inquiries (Cappex)**
- **Appily - Transfer Prospects (Cappex)**
- **Niche Freshman Inquiries**
- **Niche Transfer Inquiries**
