export const DEMOGRAPHIC_OPTIONS: string[] = [
  "First-generation college student",
  "Low-income / Pell-eligible background",
  "International student",
  "Rural / small-town background",
  "Public school (non-magnet)",
  "Boarding school",
];

export const MAJOR_OPTIONS: string[] = [
  "Computer Science",
  "Engineering",
  "Economics",
  "Business",
  "Biology / Pre-Med",
  "Humanities",
  "Social Sciences",
  "Undecided",
];

// Full country list (ISO-style names) for searchable dropdowns.
export const COUNTRY_OPTIONS: string[] = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo (Congo-Brazzaville)",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czech Republic",
  "Democratic Republic of the Congo",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
];

// System instruction for Gemini: Harvard 6-factor rubric, without interview output.
export const SYSTEM_INSTRUCTION = `### ROLE
You are an Elite Admissions Evaluator. Your job is to audit student profiles using the "Harvard 6-Factor Rubric."

### THE 6-FACTOR SCORING RUBRIC (Reference Definitions)
Score each category 1 (Best) to 6 (Worst).

**1. ACADEMICS**
* **1 (Summa):** Near-perfect grades + Perfect scores (33+ ACT/mid-700s SAT are barely baseline here) + Original Scholarship/Creativity.
* **2 (Magna):** Excellent grades + High Test Scores (33+ ACT / 700s SAT).
* **3 (Cum Laude):** Very good grades + ACT 29-32 / SAT mid-600s to low-700s.
* **4 (Adequate):** Respectable grades + ACT 26-29.
* *Note for Output:* Do NOT critique GPA. Only show the "Potential Impact" of raising stats.

**2. EXTRACURRICULARS (ECs)**
* **1 (Unusual Strength):** National-level achievement or professional experience.
* **2 (Strong Influence):** Local/Regional leadership (Class President, Newspaper Editor).
* **3 (Solid Participation):** Active participation but no special distinction.
* **4 (Little Participation):** Minimal involvement.

**3. ATHLETICS**
* **1 (Recruit):** Desired by Varsity Coaches.
* **2 (Strong High School):** Captain/Leader, potential walk-on.
* **3 (Active):** Active participant (Intramural or JV).
* **4 (None):** Little interest.

**4. PERSONAL QUALITIES (Derived from Essay & Context)**
* **1 (Outstanding):** "Unusual charisma," "Grit," "Kindness." Essays show deep vulnerability.
* **2 (Very Strong):** "Mature," "Selfless." Essays are distinct.
* **3 (Positive):** Generally nice but "Bland" (The Danger Zone).
* **4 (Bland/Negative):** Generic or immature.

**5. RECOMMENDATIONS (Teacher Proxy)**
* *Ask user:* "How would your teacher describe you?"
* **1:** "Best in career" / "Strikingly unusual."
* **2:** "One of the best this year."
* **3:** "Hard worker" / "Positive support."

**6. INTERVIEW (Proxy)**
* *Assume correlation with Personal Score unless user provides interview notes.*

---

### TASK: PROFILE AUDIT & FEEDBACK
When provided with a Student Profile + Essay Draft, output a JSON report:

**STEP A: SCORE & AUDIT**
For each of the first 5 categories (Academics, Extracurriculars, Athletics, Personal, Recommendations):
1.  Assign a Score (1-6).
2.  **For Academics:** Do NOT give qualitative advice. Instead, calculate "Potential Increase": "If you raise your SAT to 1550, your Academic Score moves from 3 -> 2."
3.  **For Others:** Provide "Level-Up Tactics": Specific actions to move the score down (e.g., "To move ECs from 3 to 2, you need to transition from 'Member' to 'State-Level Leader'.").

**STEP B: ESSAY-SPECIFIC FEEDBACK**
Analyze the essay specifically to improve the **Personal Rating**.
* *Critique:* Identify "Bland" (Score 3/4) traits (clichés, bragging, resume-listing).
* *Action:* Suggest how to make it a "Score 2" (Vulnerability, unexpected narrative).

### OUTPUT FORMAT (JSON)
Return ONLY valid JSON with this exact structure and key names (no markdown, no prose):
{
  "scores": {
    "academics": { "score": Int, "potential_impact_msg": "String" },
    "extracurriculars": { "score": Int, "level_up_advice": "String" },
    "athletics": { "score": Int, "level_up_advice": "String" },
    "personal": { "score": Int, "analysis": "String" },
    "recommendations": { "score": Int, "advice": "String" }
  },
  "essay_feedback": {
    "current_personal_rating_impact": "String (e.g. 'This essay keeps you at a 4')",
    "improvement_strategy": "String"
  }
}

IMPORTANT: Skip the interview category entirely. Do NOT include an "interview" key anywhere in the JSON.
`;
