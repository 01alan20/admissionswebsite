import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useOnboardingContext } from '../context/OnboardingContext';
import {
  InstitutionDetail,
  InstitutionMetrics,
  InstitutionMajorsByInstitution,
  InstitutionDemographics,
  MajorsMeta,
} from '../types';
import { categorizeTestPolicy } from '../utils/admissionsModel';
// removed tuition trend chart
import {
  getInstitutionDetail,
  getInstitutionMetrics,
  getMajorsMeta,
  getMajorsByInstitution,
  getInstitutionDemographics,
} from '../data/api';

const StatCard: React.FC<{ label: string; value: string | number | null | undefined }> = ({
  label,
  value,
}) => (
  <div className="p-3 rounded-lg bg-gray-50 text-center">
    <p className="text-2xl font-bold text-brand-dark">{value ?? 'N/A'}</p>
    <p className="text-xs text-gray-600 uppercase tracking-wider">{label}</p>
  </div>
);

const TestScoreRange: React.FC<{
  label: string;
  min: number;
  max: number;
  p25?: number | null;
  p50?: number | null;
  p75?: number | null;
}> = ({ label, min, max, p25, p50, p75 }) => {
  if (p25 == null || p75 == null) {
    return (
      <div>
        <h5 className="font-semibold text-gray-800">{label}</h5>
        <p className="text-sm text-gray-500 mt-1">Data not available</p>
      </div>
    );
  }

  const range = max - min;
  const p25left = ((p25 - min) / range) * 100;
  const p75right = ((max - p75) / range) * 100;
  const p50left = p50 != null ? ((p50 - min) / range) * 100 : null;

  return (
    <div>
      <h5 className="font-semibold text-gray-800 mb-2">{label}</h5>
      <div className="relative h-2 w-full bg-gray-200 rounded-full">
        <div
          className="absolute h-2 bg-brand-secondary rounded-full"
          style={{ left: `${p25left}%`, right: `${p75right}%` }}
        ></div>
        {p50left !== null && (
          <div
            className="absolute h-4 w-1 bg-brand-dark -top-1 rounded-full"
            style={{ left: `calc(${p50left}% - 2px)` }}
            title={`Median: ${p50}`}
          ></div>
        )}
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1 px-1">
        <span>{min}</span>
        <span>{max}</span>
      </div>
      <p className="text-center text-sm font-medium text-gray-800 mt-1">
        25th: <strong>{p25}</strong> | 50th: <strong>{p50 ?? 'N/A'}</strong> | 75th: <strong>{p75}</strong>
      </p>
    </div>
  );
};

const DEMOGRAPHIC_COLORS: Record<string, string> = {
  white: '#4b5563',
  asian: '#0ea5e9',
  black_or_african_american: '#7c3aed',
  hispanic_or_latino: '#f59e0b',
  native_hawaiian_or_pacific_islander: '#14b8a6',
  nonresident: '#22c55e',
  other: '#94a3b8',
};

type GroupDef = {
  key: string;
  label: string;
  sourceKeys: string[];
  color: string;
};

const DEMOGRAPHIC_GROUPS: GroupDef[] = [
  { key: 'white', label: 'White', sourceKeys: ['white'], color: DEMOGRAPHIC_COLORS.white },
  { key: 'asian', label: 'Asian', sourceKeys: ['asian'], color: DEMOGRAPHIC_COLORS.asian },
  { key: 'black', label: 'Black', sourceKeys: ['black_or_african_american'], color: DEMOGRAPHIC_COLORS.black_or_african_american },
  { key: 'latino', label: 'Latino', sourceKeys: ['hispanic_or_latino'], color: DEMOGRAPHIC_COLORS.hispanic_or_latino },
  { key: 'pacific', label: 'Hawaii/Pacific', sourceKeys: ['native_hawaiian_or_pacific_islander'], color: DEMOGRAPHIC_COLORS.native_hawaiian_or_pacific_islander },
  { key: 'international', label: 'International', sourceKeys: ['nonresident'], color: DEMOGRAPHIC_COLORS.nonresident },
  {
    key: 'other',
    label: 'Other',
    sourceKeys: ['american_indian_or_alaska_native', 'two_or_more_races', 'unknown'],
    color: DEMOGRAPHIC_COLORS.other,
  },
];

type DemographicGroupSlice = GroupDef & { percent: number | null };

const DemographicsDonut: React.FC<{ groups: DemographicGroupSlice[] }> = ({ groups }) => {
  if (!groups.length) return null;

  const totalPct = groups.reduce((sum, g) => sum + (g.percent ?? 0), 0);
  let cursor = 0;
  const stops: string[] = [];
  groups.forEach((g) => {
    const pct = g.percent ?? 0;
    const next = cursor + pct;
    stops.push(`${g.color} ${cursor}% ${next}%`);
    cursor = next;
  });
  if (cursor < 100) {
    stops.push(`#e5e7eb ${cursor}% 100%`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div
          className="w-32 h-32 rounded-full border border-gray-100 shadow-sm"
          style={{ backgroundImage: `conic-gradient(${stops.join(', ')})` }}
          aria-label="Demographic distribution"
        >
          <div className="w-16 h-16 bg-white rounded-full m-auto relative top-8 shadow-inner flex items-center justify-center text-xs font-semibold text-gray-700">
            {totalPct ? `${Math.min(100, totalPct).toFixed(0)}%` : '—'}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-800">
          {groups.map((g) => {
            const label = g.percent != null ? (g.percent >= 10 ? g.percent.toFixed(0) : g.percent.toFixed(1)) : '—';
            return (
              <div key={g.key} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm border border-gray-200" style={{ backgroundColor: g.color }}></span>
                <span className="truncate">{g.label}</span>
                <span className="ml-auto font-semibold">{label}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={addToTargets}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-secondary px-5 py-2.5 text-white text-sm font-semibold shadow-sm hover:bg-brand-primary transition"
        >
          Add to My Target Schools
        </button>
      </div>
    </div>
  );
};

const DetailPage: React.FC = () => {
  const { unitid } = useParams<{ unitid: string }>();
  const [detail, setDetail] = useState<InstitutionDetail | null>(null);
  const [metrics, setMetrics] = useState<InstitutionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [majorsMeta, setMajorsMeta] = useState<MajorsMeta | null>(null);
  const [majorsByInstitution, setMajorsByInstitution] = useState<InstitutionMajorsByInstitution | null>(null);
  const [demographics, setDemographics] = useState<InstitutionDemographics | null>(null);
  const { targetUnitIds, setTargetUnitIds } = useOnboardingContext();
  const unitIdNumber = unitid ? Number(unitid) : null;

  useEffect(() => {
    const fetchData = async () => {
      if (!unitid) return;
      try {
        setLoading(true);
        const detailData = await getInstitutionDetail(unitid);
        let metricsData: InstitutionMetrics | null = null;
        try {
          metricsData = await getInstitutionMetrics(unitid);
        } catch {
          metricsData = null;
        }
        if (!detailData) {
          throw new Error('University data not found.');
        }
        setDetail(detailData);
        setMetrics(metricsData);
        setError(null);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [unitid]);

  useEffect(() => {
    if (!unitid) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getInstitutionDemographics(unitid);
        if (!cancelled) setDemographics(data);
      } catch {
        if (!cancelled) setDemographics(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unitid]);

  useEffect(() => {
    (async () => {
      try {
        const [meta, byInst] = await Promise.all([getMajorsMeta(), getMajorsByInstitution()]);
        setMajorsMeta(meta);
        setMajorsByInstitution(byInst);
      } catch {
        // majors data is optional; ignore failures
      }
    })();
  }, []);

  if (loading) return <div className="text-center p-10">Loading university details...</div>;
  if (error) return <div className="text-center p-10 text-red-500">Error: {error}</div>;
  if (!detail) return <div className="text-center p-10">University not found.</div>;

  const profile = detail.profile;
  const latestMetric = metrics?.metrics && metrics.metrics.length
    ? [...metrics.metrics].sort((a, b) => b.year - a.year)[0]
    : null;

  const applicants = latestMetric?.applicants_total;
  const admitted = latestMetric?.admissions_total ?? latestMetric?.admitted_est;
  const enrolled = latestMetric?.enrolled_total ?? latestMetric?.enrolled_est;
  const admittedRate = applicants && admitted ? admitted / applicants : profile.outcomes.acceptance_rate ?? 0;
  const yieldRate = admitted && enrolled ? enrolled / admitted : profile.outcomes.yield ?? 0;

  const majorsTree = (() => {
    if (!majorsMeta || !majorsByInstitution) return [];
    const key = String(profile.unitid);
    const inst = majorsByInstitution[key];
    if (!inst) return [];
    const twoList = (inst.two_digit || []).filter((code) => code && code.length === 2);
    const fourList = inst.four_digit || [];
    const sixList = inst.six_digit || [];

    return twoList
      .slice()
      .sort()
      .map((two) => {
        const title = cleanCipTitle(majorsMeta.two_digit?.[two] || two);
        const fours = fourList
          .filter((code) => code.startsWith(`${two}.`))
          .slice()
          .sort()
          .map((four) => {
            const fTitle = cleanCipTitle(majorsMeta.four_digit?.[four] || four);
            const sixes = sixList
              .filter((six) => six.startsWith(four))
              .slice()
              .sort()
              .map((six) => ({
                code: six,
                title: cleanCipTitle(majorsMeta.six_digit?.[six] || six),
              }));
            return { code: four, title: fTitle, sixes };
          });
        return { code: two, title, fours };
      })
      .filter((node) => node.fours.length > 0);
  })();

  const percentByKey = useMemo(() => {
    const map = new Map<string, number>();
    (demographics?.breakdown || []).forEach((slice) => {
      if (slice.percent != null) map.set(slice.key, slice.percent);
    });
    return map;
  }, [demographics]);

  const demographicGroups: DemographicGroupSlice[] = useMemo(() => {
    return DEMOGRAPHIC_GROUPS.map((g) => {
      const pct = g.sourceKeys.reduce((sum, key) => sum + (percentByKey.get(key) ?? 0), 0);
      const hasData = g.sourceKeys.some((key) => percentByKey.has(key));
      return { ...g, percent: hasData ? pct : null };
    }).filter((g) => g.percent != null);
  }, [percentByKey]);

  const genderBalance = useMemo(() => {
    const men = demographics?.total_undergrad_men ?? null;
    const women = demographics?.total_undergrad_women ?? null;
    const total = demographics?.total_undergrad ?? null;
    if (!total || total <= 0 || men == null || women == null) return null;
    return {
      men: Math.max(0, Math.min(100, (men / total) * 100)),
      women: Math.max(0, Math.min(100, (women / total) * 100)),
    };
  }, [demographics]);

  const hasDemographics = demographicGroups.length > 0;
  const addToTargets = () => {
    if (!unitIdNumber) return;
    const next = Array.from(new Set([...(targetUnitIds || []), unitIdNumber]));
    setTargetUnitIds(next);
  };

  return (
    <div className="space-y-6">
      <Link
        to="/explore"
        className="inline-flex items-center text-brand-secondary hover:text-brand-dark font-medium transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
            clipRule="evenodd"
          />
        </svg>
        Back to Explore
      </Link>

      <header>
        <h1 className="text-4xl font-extrabold text-brand-dark">{profile.name}</h1>
        <p className="text-lg text-gray-600 mt-1">
          {profile.city}, {profile.state} - {profile.control} - {profile.level}
        </p>
        <div className="flex flex-wrap gap-2 mt-4 text-sm">
          <span className="bg-yellow-200 text-yellow-800 font-semibold px-3 py-1 rounded-full">
            Test policy: {formatTestPolicy(profile.test_policy)}
          </span>
          {profile.major_families.slice(0, 5).map((major) => (
            <span key={major} className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full">
              {major}
            </span>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={addToTargets}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-secondary px-4 py-2 text-white text-sm font-semibold shadow-sm hover:bg-brand-primary transition"
          >
            Add to My Target Schools
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <main className="lg:col-span-2 space-y-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard
                label="Acceptance rate"
                value={profile.outcomes.acceptance_rate ? `${(profile.outcomes.acceptance_rate * 100).toFixed(0)}%` : 'N/A'}
              />
              <StatCard
                label="Yield"
                value={profile.outcomes.yield ? `${(profile.outcomes.yield * 100).toFixed(0)}%` : 'N/A'}
              />
              <StatCard
                label="6-year graduation"
                value={profile.outcomes.grad_rate_6yr ? `${(profile.outcomes.grad_rate_6yr * 100).toFixed(0)}%` : 'N/A'}
              />
              <StatCard
                label="Retention"
                value={
                  profile.outcomes.retention_full_time
                    ? `${(profile.outcomes.retention_full_time * 100).toFixed(0)}%`
                    : 'N/A'
                }
              />
              <StatCard
                label="Int'l students"
                value={profile.intl_enrollment_pct ? `${(profile.intl_enrollment_pct * 100).toFixed(0)}%` : 'N/A'}
              />
              <StatCard
                label="Total enrollment"
                value={profile.outcomes.total_enrollment?.toLocaleString() ?? 'N/A'}
              />
            </div>
          </div>

          {applicants && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-bold text-brand-dark mb-4">Admissions funnel</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 items-end gap-6 text-center">
                <div>
                  <p className="text-lg font-bold">{applicants.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">Applicants</p>
                </div>
                <div>
                  <p className="font-bold text-sm mb-1">{(admittedRate * 100).toFixed(0)}%</p>
                  <p className="text-xs text-gray-600 mb-2">{admitted?.toLocaleString()} Admitted</p>
                  <div className="overflow-hidden h-2 rounded bg-gray-200">
                    <div style={{ width: `${admittedRate * 100}%` }} className="h-2 bg-blue-500"></div>
                  </div>
                </div>
                <div>
                  <p className="font-bold text-sm mb-1">{(yieldRate * 100).toFixed(0)}%</p>
                  <p className="text-xs text-gray-600 mb-2">{enrolled?.toLocaleString()} Enrolled</p>
                  <div className="overflow-hidden h-2 rounded bg-gray-200">
                    <div style={{ width: `${yieldRate * 100}%` }} className="h-2 bg-indigo-500"></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-brand-dark mb-4">Cost Planner</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500">Out-of-state tuition & fees</p>
                <p className="text-3xl font-bold text-brand-primary">
                  {profile.tuition_summary.out_of_state
                    ? `$${profile.tuition_summary.out_of_state.toLocaleString()}`
                    : 'N/A'}
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  Use this as the starting point for your annual cost of attendance. Add housing, health insurance, books,
                  and travel from the university&apos;s cost estimator.
                </p>
              </div>
              <div className="border-t md:border-t-0 md:border-l pl-0 md:pl-6 pt-4 md:pt-0">
                <p className="text-sm text-gray-500">In-state tuition (reference)</p>
                <p className="text-2xl font-semibold text-gray-700">
                  {profile.tuition_summary.in_state
                    ? `$${profile.tuition_summary.in_state.toLocaleString()}`
                    : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-brand-dark mb-3">Admission requirements</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
              <div>
                <h4 className="font-semibold text-gray-800 border-b pb-1 mb-2">Required:</h4>
                <ul className="space-y-1 list-inside list-disc text-gray-700">
                  {detail.requirements.required.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 border-b pb-1 mb-2">Considered:</h4>
                <ul className="space-y-1 list-inside list-disc text-gray-700">
                  {detail.requirements.considered.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 border-b pb-1 mb-2">Not Considered:</h4>
                <ul className="space-y-1 list-inside list-disc text-gray-700">
                  {detail.requirements.not_considered.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {latestMetric && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-bold text-brand-dark mb-2">Test scores &amp; submission rates</h2>
              <p className="text-sm text-gray-600 mb-6">
                Submission percentages reference accepted students reporting each exam. Use the 25th/50th/75th percentile
                scores to gauge how you compare to the latest admitted class.
              </p>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-bold mb-3">SAT</h3>
                  {latestMetric.percent_of_first_time_degree_certificate_seeking_students_submitting_sat_scores ? (
                    <p className="text-sm mb-4">
                      Test submission:{' '}
                      <strong>
                        {latestMetric.percent_of_first_time_degree_certificate_seeking_students_submitting_sat_scores.toFixed(0)}
                        %
                      </strong>{' '}
                      (
                      {latestMetric.number_of_first_time_degree_certificate_seeking_students_submitting_sat_scores?.toLocaleString()}{' '}
                      students)
                    </p>
                  ) : null}
                  <div className="space-y-6">
                    <TestScoreRange
                      label="SAT Evidence-Based Reading & Writing"
                      min={200}
                      max={800}
                      p25={latestMetric.sat_evidence_based_reading_and_writing_25th_percentile_score}
                      p50={latestMetric.sat_evidence_based_reading_and_writing_50th_percentile_score}
                      p75={latestMetric.sat_evidence_based_reading_and_writing_75th_percentile_score}
                    />
                    <TestScoreRange
                      label="SAT Math"
                      min={200}
                      max={800}
                      p25={latestMetric.sat_math_25th_percentile_score}
                      p50={latestMetric.sat_math_50th_percentile_score}
                      p75={latestMetric.sat_math_75th_percentile_score}
                    />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-3">ACT</h3>
                  {latestMetric.percent_of_first_time_degree_certificate_seeking_students_submitting_act_scores ? (
                    <p className="text-sm mb-4">
                      Test submission:{' '}
                      <strong>
                        {latestMetric.percent_of_first_time_degree_certificate_seeking_students_submitting_act_scores.toFixed(0)}
                        %
                      </strong>{' '}
                      (
                      {latestMetric.number_of_first_time_degree_certificate_seeking_students_submitting_act_scores?.toLocaleString()}{' '}
                      students)
                    </p>
                  ) : null}
                  <div className="space-y-6">
                    <TestScoreRange
                      label="ACT Composite"
                      min={1}
                      max={36}
                      p25={latestMetric.act_composite_25th_percentile_score}
                      p50={latestMetric.act_composite_50th_percentile_score}
                      p75={latestMetric.act_composite_75th_percentile_score}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {hasDemographics && (
            <div className="bg-white p-6 rounded-lg shadow-md space-y-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-2xl font-bold text-brand-dark mb-1">Campus diversity</h2>
                  {demographics?.total_undergrad != null && (
                    <p className="text-sm text-gray-600">
                      Total undergrads:{' '}
                      <span className="font-semibold text-gray-800">
                        {demographics.total_undergrad.toLocaleString()}
                      </span>
                    </p>
                  )}
                </div>
                {genderBalance && (
                  <div className="text-sm text-gray-700 min-w-[220px]">
                    <div className="font-semibold mb-1">Gender balance</div>
                    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden flex">
                      <div
                        className="h-2 bg-blue-500"
                        style={{ width: `${genderBalance.men}%` }}
                        title={`Men: ${genderBalance.men.toFixed(1)}%`}
                      />
                      <div
                        className="h-2 bg-pink-400"
                        style={{ width: `${genderBalance.women}%` }}
                        title={`Women: ${genderBalance.women.toFixed(1)}%`}
                      />
                    </div>
                    <div className="flex justify-between text-[12px] text-gray-600 mt-1">
                      <span>Men {genderBalance.men.toFixed(1)}%</span>
                      <span>Women {genderBalance.women.toFixed(1)}%</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-2">
                <DemographicsDonut groups={demographicGroups} />
              </div>
            </div>
          )}

          {majorsTree.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-bold text-brand-dark mb-3">Bachelor&apos;s majors offered</h2>
              <div className="space-y-3">
                {majorsTree.map((two) => (
                  <details key={two.code} className="border rounded-md">
                    <summary className="cursor-pointer px-3 py-2 font-semibold">
                      {two.title}
                    </summary>
                    <div className="px-3 py-2 space-y-2">
                      {two.fours.map((four) => (
                        <details key={four.code} className="border rounded-md">
                          <summary className="cursor-pointer px-3 py-1 text-sm font-semibold">
                            {four.title}
                          </summary>
                          {four.sixes.length > 0 && (
                            <ul className="px-4 py-2 list-disc list-inside text-sm text-gray-700">
                              {four.sixes.map((six) => (
                                <li key={six.code}>
                                  {six.title}
                                </li>
                              ))}
                            </ul>
                          )}
                        </details>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}
        </main>
        <aside className="space-y-6 sticky top-24">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-bold text-brand-dark mb-4">Quick links</h3>
            <ul className="space-y-2">
              {profile.website && (
                <li>
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-secondary hover:underline font-medium"
                  >
                    Institution website
                  </a>
                </li>
              )}
              {profile.admissions_url && (
                <li>
                  <a
                    href={profile.admissions_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-secondary hover:underline font-medium"
                  >
                    Admissions website
                  </a>
                </li>
              )}
              {profile.financial_aid_url && (
                <li>
                  <a
                    href={profile.financial_aid_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-secondary hover:underline font-medium"
                  >
                    Financial aid website
                  </a>
                </li>
              )}
            </ul>
            <p className="text-xs text-gray-500 mt-3">
              Always confirm visa requirements, scholarship forms, and exact deadlines on the official admissions and
              financial aid sites—dates vary by program and citizenship.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default DetailPage;

function cleanCipTitle(value: string | null | undefined): string {
  if (!value) return '';
  let t = String(value).trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim();
  } else {
    if (t.startsWith('"') || t.startsWith("'")) t = t.slice(1).trim();
    if (t.endsWith('"') || t.endsWith("'")) t = t.slice(0, -1).trim();
  }
  return t;
}

function formatTestPolicy(value: string | null | undefined): string {
  const category = categorizeTestPolicy(value ?? '');
  if (category === 'flexible') return 'Test flexible';
  if (category === 'optional') return 'Test optional';
  if (category === 'not_considered') return 'Test blind';
  if (!value) return 'Unknown';
  return 'Required';
}
