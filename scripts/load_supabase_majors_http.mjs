import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
      "Go to Supabase -> Project Settings -> API and copy the project URL and service role key."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const knownCipCodes = new Set();

const majorsMetaPath = path.join(
  process.cwd(),
  "public",
  "data",
  "University_data",
  "majors_bachelor_meta.json"
);
const majorsByInstPath = path.join(
  process.cwd(),
  "public",
  "data",
  "University_data",
  "majors_bachelor_by_institution.json"
);
const institutionsPath = path.join(
  process.cwd(),
  "public",
  "data",
  "University_data",
  "institutions.json"
);

async function loadMajorsMeta() {
  console.log("Loading majors meta from", majorsMetaPath);
  const text = fs.readFileSync(majorsMetaPath, "utf8");
  const data = JSON.parse(text);

  const rows = [];
  const levels = [
    ["two_digit", "2-digit"],
    ["four_digit", "4-digit"],
    ["six_digit", "6-digit"],
  ];

  for (const [key, levelLabel] of levels) {
    const mapping = data[key];
    if (!mapping || typeof mapping !== "object") continue;
    for (const [code, title] of Object.entries(mapping)) {
      if (!code) continue;
      const t = String(title ?? "").trim();
      if (!t) continue;
      knownCipCodes.add(String(code));
      rows.push({
        cip_code: String(code),
        cip_level: levelLabel,
        title: t,
      });
    }
  }

  console.log(`Prepared ${rows.length} rows for majors_meta`);

  const { data: resp, error } = await supabase.from("majors_meta").upsert(rows).select("cip_code");
  if (error) {
    console.error("Error upserting majors_meta:", error);
    process.exit(1);
  }
  console.log(`Upserted majors_meta rows reported=${resp ? resp.length : 0}`);
}

async function loadInstitutionMajors() {
  console.log("Loading institution majors from", majorsByInstPath);

  const instText = fs.readFileSync(institutionsPath, "utf8");
  const instData = JSON.parse(instText);
  const validIds = new Set(instData.map((d) => Number(d.unitid)).filter(Number.isFinite));
  console.log(`Loaded ${validIds.size} institution ids from ${institutionsPath}`);

  const text = fs.readFileSync(majorsByInstPath, "utf8");
  const data = JSON.parse(text);

  const rows = [];
  for (const [unitidStr, entry] of Object.entries(data)) {
    const unitid = Number(unitidStr);
    if (!Number.isFinite(unitid) || !validIds.has(unitid) || !entry || typeof entry !== "object") continue;

    const { two_digit = [], four_digit = [], six_digit = [] } = entry;

    for (const code of two_digit) {
      if (!code) continue;
      const c = String(code);
      if (!knownCipCodes.has(c)) continue;
      rows.push({ unitid, cip_level: "2-digit", cip_code: c });
    }
    for (const code of four_digit) {
      if (!code) continue;
      const c = String(code);
      if (!knownCipCodes.has(c)) continue;
      rows.push({ unitid, cip_level: "4-digit", cip_code: c });
    }
    for (const code of six_digit) {
      if (!code) continue;
      const c = String(code);
      if (!knownCipCodes.has(c)) continue;
      rows.push({ unitid, cip_level: "6-digit", cip_code: c });
    }
  }

  console.log(`Prepared ${rows.length} rows for institution_majors`);

  const pageSize = 1000;
  for (let i = 0; i < rows.length; i += pageSize) {
    const chunk = rows.slice(i, i + pageSize);
    console.log(`Chunk ${i / pageSize + 1}: inserting ${chunk.length} rows`);

    const { data: resp, error } = await supabase
      .from("institution_majors")
      .upsert(chunk)
      .select("unitid, cip_code");
    if (error) {
      console.error("Error upserting institution_majors chunk:", error);
      process.exit(1);
    }
    console.log(`Chunk ${i / pageSize + 1}: upserted rows reported=${resp ? resp.length : 0}`);
  }

  console.log("Finished loading institution_majors into Supabase via HTTP API.");
}

async function main() {
  console.log("Supabase URL:", supabaseUrl);
  await loadMajorsMeta();
  await loadInstitutionMajors();
}

main().catch((err) => {
  console.error("Unexpected error loading majors data:", err);
  process.exit(1);
});

