import React, { useState, useEffect } from 'react';
import { Institution, InstitutionMetrics, InstitutionDetail } from '../types';
import { getInstitutionIndex, getInstitutionSummary, getInstitutionDetail, getInstitutionMetrics, InstitutionIndex } from '../data/api';

type CompareEntry = {
  summary: Institution;
  detail?: InstitutionDetail | null;
  metrics?: InstitutionMetrics | null;
};

const ComparePage: React.FC = () => {
  const [index, setIndex] = useState<InstitutionIndex[]>([]);
  const [selected, setSelected] = useState<CompareEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    (async () => {
      const idx = await getInstitutionIndex();
      setIndex(idx);
    })();
  }, []);

  const handleSelect = (entry: CompareEntry) => {
    if (selected.length < 3 && !selected.find(s => s.summary.unitid === entry.summary.unitid)) {
      setSelected([...selected, entry]);
    }
    setSearchTerm('');
  };

  const handleRemove = (unitid: number) => {
    setSelected(selected.filter(s => s.summary.unitid !== unitid));
  };

  const searchResults = searchTerm
    ? index
        .filter(item => {
          const q = searchTerm.toLowerCase();
          const hay = `${item.name ?? ''} ${item.city ?? ''} ${item.state ?? ''}`.toLowerCase();
          return hay.includes(q);
        })
        .filter(item => !selected.find(s => s.unitid === item.unitid))
        .slice(0, 8)
    : [];

  const handleSelectIndex = async (item: InstitutionIndex) => {
    const [summary, detail, metrics] = await Promise.all([
      getInstitutionSummary(item.unitid),
      getInstitutionDetail(item.unitid),
      getInstitutionMetrics(item.unitid),
    ]);
    handleSelect({ summary, detail, metrics });
  };

  const renderMetricRow = (label: string, key: keyof Institution) => {
    return (
        <tr className="border-b">
            <td className="py-3 px-4 font-semibold text-gray-700">{label}</td>
            {selected.map(entry => (
                <td key={entry.summary.unitid} className="py-3 px-4 text-center">{(entry.summary[key] as any) ?? 'N/A'}</td>
            ))}
            {Array(3 - selected.length).fill(0).map((_, i) => <td key={i} className="py-3 px-4"></td>)}
        </tr>
    );
  };
  
  const formatNumber = (value: number | null | undefined, isPercent: boolean = false) => {
    if (value === null || value === undefined) return 'N/A';
    if (isPercent) return `${(value * 100).toFixed(1)}%`;
    return `$${value.toLocaleString()}`;
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-xl">
      <h1 className="text-3xl font-bold text-brand-dark mb-2">Compare Universities</h1>
      <p className="text-gray-600 mb-6">Select up to three universities to compare their key statistics.</p>

      <div className="relative mb-6">
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Add a university to compare..."
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-brand-secondary focus:border-brand-secondary"
        />
        {searchResults.length > 0 && (
          <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg mt-1 shadow-lg">
            {searchResults.map(item => (
              <li key={item.unitid} onClick={() => handleSelectIndex(item)} className="p-3 hover:bg-brand-light cursor-pointer">
                {item.name}
                {item.city ? <span className="text-gray-500 text-sm"> — {item.city}, {item.state}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-left">
          <thead>
            <tr className="bg-brand-light">
              <th className="py-3 px-4 font-semibold text-brand-dark rounded-tl-lg w-1/4">Metric</th>
              {selected.map(entry => (
                <th key={entry.summary.unitid} className="py-3 px-4 font-semibold text-brand-dark text-center">
                  {entry.summary.name}
                  <button onClick={() => handleRemove(entry.summary.unitid)} className="ml-2 text-red-500 hover:text-red-700">&times;</button>
                </th>
              ))}
              {Array(3 - selected.length).fill(0).map((_, i) => <th key={i} className={`py-3 px-4 ${i === (2 - selected.length) ? 'rounded-tr-lg' : ''}`}></th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b"><td className="py-3 px-4 font-bold text-brand-primary bg-gray-50" colSpan={4}>General</td></tr>
            {renderMetricRow('Location', 'city')}
            {renderMetricRow('Control', 'control')}

            
            <tr className="border-b"><td className="py-3 px-4 font-bold text-brand-primary bg-gray-50" colSpan={4}>Admissions</td></tr>
            <tr className="border-b">
                <td className="py-3 px-4 font-semibold text-gray-700">Acceptance Rate</td>
                {selected.map(entry => <td key={entry.summary.unitid} className="py-3 px-4 text-center">{formatNumber(entry.summary.acceptance_rate, true)}</td>)}
                 {Array(3 - selected.length).fill(0).map((_, i) => <td key={i} className="py-3 px-4"></td>)}
            </tr>
             <tr className="border-b">
                <td className="py-3 px-4 font-semibold text-gray-700">Yield Rate</td>
                {selected.map(entry => <td key={entry.summary.unitid} className="py-3 px-4 text-center">{formatNumber(entry.summary.yield, true)}</td>)}
                 {Array(3 - selected.length).fill(0).map((_, i) => <td key={i} className="py-3 px-4"></td>)}
            </tr>
             <tr className="border-b">
                <td className="py-3 px-4 font-semibold text-gray-700">Test Policy</td>
                {selected.map(entry => <td key={entry.summary.unitid} className="py-3 px-4 text-center">{entry.summary.test_policy}</td>)}
                 {Array(3 - selected.length).fill(0).map((_, i) => <td key={i} className="py-3 px-4"></td>)}
            </tr>

            <tr className="border-b"><td className="py-3 px-4 font-bold text-brand-primary bg-gray-50" colSpan={4}>Test Scores</td></tr>
            <tr className="border-b">
              <td className="py-3 px-4 font-semibold text-gray-700">SAT Evidence-Based Reading and Writing (50th)</td>
              {selected.map(entry => {
                const lm = latest(entry.metrics);
                const mid = lm?.sat_evidence_based_reading_and_writing_50th_percentile_score ?? null;
                return <td key={entry.summary.unitid} className="py-3 px-4 text-center">{mid ?? 'N/A'}</td>;
              })}
              {Array(3 - selected.length).fill(0).map((_, i) => <td key={i} className="py-3 px-4"></td>)}
            </tr>
            <tr className="border-b">
              <td className="py-3 px-4 font-semibold text-gray-700">SAT Math (50th)</td>
              {selected.map(entry => {
                const lm = latest(entry.metrics);
                const mid = lm?.sat_math_50th_percentile_score ?? null;
                return <td key={entry.summary.unitid} className="py-3 px-4 text-center">{mid ?? 'N/A'}</td>;
              })}
              {Array(3 - selected.length).fill(0).map((_, i) => <td key={i} className="py-3 px-4"></td>)}
            </tr>
            <tr className="border-b">
              <td className="py-3 px-4 font-semibold text-gray-700">ACT Composite (50th)</td>
              {selected.map(entry => {
                const lm = latest(entry.metrics);
                const mid = lm?.act_composite_50th_percentile_score ?? null;
                return <td key={entry.summary.unitid} className="py-3 px-4 text-center">{mid ?? 'N/A'}</td>;
              })}
              {Array(3 - selected.length).fill(0).map((_, i) => <td key={i} className="py-3 px-4"></td>)}
            </tr>

            <tr className="border-b"><td className="py-3 px-4 font-bold text-brand-primary bg-gray-50" colSpan={4}>Tuition (2023-24)</td></tr>
            <tr className="border-b">
                <td className="py-3 px-4 font-semibold text-gray-700">In-State</td>
                {selected.map(entry => <td key={entry.summary.unitid} className="py-3 px-4 text-center">{formatNumber(entry.summary.tuition_2023_24_in_state)}</td>)}
                 {Array(3 - selected.length).fill(0).map((_, i) => <td key={i} className="py-3 px-4"></td>)}
            </tr>
             <tr className="border-b">
                <td className="py-3 px-4 font-semibold text-gray-700">Out-of-State</td>
                {selected.map(entry => <td key={entry.summary.unitid} className="py-3 px-4 text-center">{formatNumber(entry.summary.tuition_2023_24_out_of_state)}</td>)}
                 {Array(3 - selected.length).fill(0).map((_, i) => <td key={i} className="py-3 px-4"></td>)}
            </tr>
          </tbody>
        </table>
      </div>
      {selected.length === 0 && <p className="text-center py-8 text-gray-500">Add a university to begin comparison.</p>}
    </div>
  );
};

export default ComparePage;

// Helpers
function latest(metrics: InstitutionMetrics | null | undefined) {
  const arr = metrics?.metrics || [];
  if (!arr.length) return null as any;
  return arr.slice().sort((a, b) => (b.year - a.year))[0];
}

// removed quick-link helpers
