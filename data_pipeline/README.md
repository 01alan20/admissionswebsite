## Data pipeline

This folder contains the Python scripts that build the static datasets under `public/data/**` for the frontend.

### Inputs

- `public/data/institutions_degrees_bachelor.csv` — IPEDS bachelor degrees by CIP code.
- `public/data/institution_sites.csv` — official institutional, admissions, and financial‑aid URLs.

### Scripts

- `etl_admissions.py` – main ETL to assemble core admissions and profile JSON files in `public/data/`.
- `build_majors_from_ipeds.py` – reads the IPEDS degrees CSV and produces:
  - `public/data/majors_bachelor_meta.json`
  - `public/data/majors_bachelor_by_institution.json`
- `merge_official_urls.py` – normalises/merges URLs from `institution_sites.csv` into `public/data/institutions.json`.

### Regenerating data

From the repo root:

```bash
python data_pipeline/etl_admissions.py
python data_pipeline/merge_official_urls.py --urls_csv public/data/institution_sites.csv --backup
python data_pipeline/build_majors_from_ipeds.py
```

After regenerating data, you can rebuild the frontend as usual:

```bash
npm run build
```

