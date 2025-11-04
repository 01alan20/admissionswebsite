export default function UniCard({ uni }) {
  const fmt = (v, suf='') => (v === null || v === undefined || Number.isNaN(v) ? '—' : `${v}${suf}`);
  return (
    <div style={{border:'1px solid #e5e7eb', borderRadius:12, padding:16, marginBottom:12}}>
      <div style={{fontSize:18, fontWeight:600}}>{uni.institution_name}</div>
      <div style={{fontSize:13, color:'#6b7280'}}>
        {(uni.state||'').toString()} • {(uni.control||'').toString()} • {(uni.level||'').toString()}
      </div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(5, minmax(0, 1fr))', gap:12, marginTop:12}}>
        <Metric label="Acceptance" value={fmt(round(uni.pct_admitted_total,1),'%')} />
        <Metric label="Yield" value={fmt(round(uni.yield_total,1),'%')} />
        <Metric label="6-yr Grad" value={fmt(round(uni.bachelor_6yr_total,1),'%')} />
        <Metric label="SAT submit" value={fmt(round(uni.sat_submitters_pct,1),'%')} />
        <Metric label="Tuition 23–24" value={fmt(number(uni.tuition_and_fees))} />
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <div style={{fontSize:11, color:'#6b7280'}}>{label}</div>
      <div style={{fontSize:16, fontWeight:600}}>{value}</div>
    </div>
  );
}

function round(v, p=1){
  const n = Number(v);
  return Number.isFinite(n) ? Number(n.toFixed(p)) : undefined;
}

function number(v){
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : '—';
}