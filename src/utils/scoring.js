export function calculateProfileScore(profile) {
  const gpaScore = normalize(profile.gpa, 4) * 40;
  const satTotal = (Number(profile.sat_math) || 0) + (Number(profile.sat_ebrw) || 0);
  const satScore = profile.tests_taken === 'sat' ? normalize(satTotal, 1600) * 35 : 0;
  const actScore = profile.tests_taken === 'act' ? normalize(Number(profile.act_composite) || 0, 36) * 35 : 0;
  const testScore = Math.max(satScore, actScore);
  const extraScore = Math.min((profile.extracurriculars?.length || 0) * 15, 25);
  const base = gpaScore + testScore + extraScore;
  return Math.round(Math.min(base, 100));
}

function normalize(value = 0, max = 1) {
  if (!max) return 0;
  const num = Math.max(0, Math.min(Number(value) || 0, max));
  return num / max;
}

export function improvementSuggestions(profile) {
  const gpaGap = Math.max(0, 4 - (profile.gpa || 0));
  const satTotal = (Number(profile.sat_math) || 0) + (Number(profile.sat_ebrw) || 0);
  const actScore = Number(profile.act_composite) || 0;
  const satGap = 1600 - satTotal || 0;
  const actGap = 36 - actScore || 0;
  const extraGap = Math.max(0, 6 - (profile.extracurriculars?.length || 0));
  return [
    { label: 'Test Scores', value: profile.tests_taken === 'act' ? actGap : satGap, impact: '+15.0%' },
    { label: 'Extracurriculars', value: extraGap, impact: '+4.0%' },
    { label: 'GPA', value: gpaGap, impact: '+2.5%' }
  ];
}
