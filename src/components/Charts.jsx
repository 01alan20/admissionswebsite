import React from "react";

export function Sparkline({ data = [], width = 120, height = 28 }) {
  const vals = data.filter(v => v != null && Number.isFinite(+v)).map(Number);
  if (vals.length < 2) return null;
  const min = Math.min(...vals), max = Math.max(...vals);
  const ny = v => (max === min ? height/2 : height - ((v - min) / (max - min)) * (height - 2) - 1);
  const step = width / (vals.length - 1);
  const d = vals.map((v, i) => `${i ? "L" : "M"}${(i*step).toFixed(2)},${ny(v).toFixed(2)}`).join(" ");
  const lastX = (vals.length-1)*step, lastY = ny(vals[vals.length-1]);
  return (
    <svg width={width} height={height}>
      <path d={d} fill="none" stroke="#507cf5" strokeWidth="2" />
      <circle cx={lastX} cy={lastY} r="2.8" fill="#507cf5" />
    </svg>
  );
}

export function BoxPlot({ q1, median, q3, domain=[0,100], width=320, height=40, label }) {
  const [dmin, dmax] = domain;
  const sx = v => (v == null ? null : Math.max(0, Math.min(width, ((v - dmin) / (dmax - dmin)) * width)));
  const x1 = sx(+q1), xm = sx(+median), x3 = sx(+q3);
  if (x1 == null || xm == null || x3 == null) return <div style={{color:"#666"}}>No data</div>;
  return (
    <div style={{display:"grid", gap:6}}>
      {label && <div style={{fontWeight:600}}>{label}</div>}
      <svg width={width} height={height}>
        <line x1="0" y1={height/2} x2={width} y2={height/2} stroke="#e6e9ef" />
        <rect x={Math.min(x1,x3)} y={height/2-8} width={Math.abs(x3-x1)} height="16" fill="#dde6ff" stroke="#bdd0ff"/>
        <line x1={xm} y1={height/2-10} x2={xm} y2={height/2+10} stroke="#507cf5" strokeWidth="2"/>
      </svg>
      <div style={{display:"flex", justifyContent:"space-between", fontSize:12, color:"#555"}}>
        <span>{domain[0]}</span>
        <span>25th: {q1} | 50th: {median} | 75th: {q3}</span>
        <span>{domain[1]}</span>
      </div>
    </div>
  );
}
