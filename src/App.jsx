import { useState, useEffect, useMemo } from "react";

// ══════════════════════════════════════════════════════════════
// PORTFOLIO REBALANCER — Canadian Investment Optimizer
// Real portfolio tool · TFSA/RRSP/FHSA · Actionable trades
// ══════════════════════════════════════════════════════════════

const C = {
  bg: "#060910", panel: "#0c1018", border: "#182030", hover: "#111722",
  accent: "#00c9a7", accentDim: "rgba(0,201,167,0.10)",
  green: "#059669", greenDim: "rgba(5,150,105,0.10)",
  red: "#dc2626", redDim: "rgba(220,38,38,0.10)",
  amber: "#d97706", amberDim: "rgba(217,119,6,0.10)",
  blue: "#2563eb", blueDim: "rgba(37,99,235,0.10)",
  purple: "#7c3aed", cyan: "#0891b2",
  text: "#e4e4e7", muted: "#a1a1aa", dim: "#52525b", surface: "#111318",
};

const ASSETS = [
  { id: "xiu", name: "Canadian Equities", ticker: "XIU.TO", color: "#3b82f6", expReturn: 0.082, risk: 0.155, yield: 2.9, mer: 0.06, category: "Equity", taxNote: "Canadian dividends get Dividend Tax Credit — best in non-registered" },
  { id: "vfv", name: "US Equities (S&P 500)", ticker: "VFV.TO", color: "#8b5cf6", expReturn: 0.105, risk: 0.178, yield: 1.3, mer: 0.09, category: "Equity", taxNote: "US dividends face 15% withholding tax — hold in RRSP to avoid this" },
  { id: "xef", name: "International Developed", ticker: "XEF.TO", color: "#06b6d4", expReturn: 0.072, risk: 0.168, yield: 2.6, mer: 0.22, category: "Equity", taxNote: "Foreign withholding tax partially recoverable in non-registered via tax credit" },
  { id: "xec", name: "Emerging Markets", ticker: "XEC.TO", color: "#f43f5e", expReturn: 0.088, risk: 0.215, yield: 2.2, mer: 0.25, category: "Equity", taxNote: "Higher risk/reward — shelter growth in TFSA for tax-free gains" },
  { id: "zag", name: "Canadian Bonds", ticker: "ZAG.TO", color: "#10b981", expReturn: 0.038, risk: 0.055, yield: 3.2, mer: 0.09, category: "Fixed Income", taxNote: "Interest taxed at full marginal rate — hold in TFSA or RRSP to shelter" },
  { id: "zre", name: "Canadian REITs", ticker: "ZRE.TO", color: "#f59e0b", expReturn: 0.065, risk: 0.142, yield: 4.1, mer: 0.61, category: "Real Estate", taxNote: "REIT distributions mostly return of capital + income — shelter in registered accounts" },
  { id: "cgl", name: "Gold", ticker: "CGL.TO", color: "#fbbf24", expReturn: 0.045, risk: 0.135, yield: 0, mer: 0.55, category: "Commodity", taxNote: "No yield — growth only. Hold in TFSA so gains are completely tax-free" },
  { id: "cash", name: "Cash / HISA ETF", ticker: "CASH.TO", color: "#94a3b8", expReturn: 0.042, risk: 0.002, yield: 4.2, mer: 0.12, category: "Cash", taxNote: "Interest income fully taxable — consider TFSA if room available" },
];

const MODEL_PORTFOLIOS = {
  conservative: { label: "Conservative", desc: "Capital preservation focus. Lower volatility, steady income. Suitable for near-retirement or low risk tolerance.", target: { xiu: 10, vfv: 8, xef: 5, xec: 2, zag: 50, zre: 8, cgl: 5, cash: 12 }, color: C.green },
  balanced: { label: "Balanced", desc: "Growth and income blend. Moderate volatility. Suitable for 10+ year horizon with moderate risk tolerance.", target: { xiu: 15, vfv: 22, xef: 10, xec: 8, zag: 25, zre: 8, cgl: 4, cash: 8 }, color: C.blue },
  growth: { label: "Growth", desc: "Capital appreciation focus. Higher volatility for higher long-term returns. Suitable for 15+ year horizon.", target: { xiu: 20, vfv: 30, xef: 13, xec: 12, zag: 12, zre: 5, cgl: 3, cash: 5 }, color: C.purple },
  aggressive: { label: "Aggressive", desc: "Maximum growth. High volatility. Only suitable for very long horizons (20+ years) and high risk tolerance.", target: { xiu: 22, vfv: 35, xef: 15, xec: 18, zag: 5, zre: 3, cgl: 0, cash: 2 }, color: C.red },
};

const ACCOUNTS = [
  { id: "tfsa", name: "TFSA", limit: 7000, cumLimit: 102000, color: C.accent, bestFor: ["Highest-growth assets (US, International, EM equities)", "Gold/commodities (shelter capital gains)", "Any asset you expect to grow the most"], reason: "All growth and withdrawals completely tax-free. Maximize by putting your highest-growth assets here." },
  { id: "rrsp", name: "RRSP", limit: 31560, cumLimit: null, color: C.blue, bestFor: ["US equities (VFV) — avoids 15% US withholding tax", "Bonds and fixed income (shelter interest)", "REITs (shelter income-heavy distributions)"], reason: "Tax-deferred growth + tax deduction on contribution. US dividends are exempt from withholding tax under Canada-US treaty." },
  { id: "fhsa", name: "FHSA", limit: 8000, cumLimit: 40000, color: C.purple, bestFor: ["Growth equities (same rationale as TFSA)", "Best of both worlds — deductible contributions + tax-free withdrawal"], reason: "If you're a first-time home buyer: contributions are tax-deductible like RRSP, withdrawals are tax-free like TFSA for qualifying home purchase." },
  { id: "nonreg", name: "Non-Registered", limit: null, cumLimit: null, color: C.amber, bestFor: ["Canadian equities (XIU) — eligible for Dividend Tax Credit", "Assets with low turnover/growth", "Overflow when registered accounts are maxed"], reason: "Canadian dividends receive preferential tax treatment through the Dividend Tax Credit. Capital gains are 50% inclusion rate." },
];

// ─── Calculation Engine ─────────────────────────────────────
function calcPortfolioStats(allocations) {
  let ret = 0, riskSq = 0, yld = 0, mer = 0;
  ASSETS.forEach(a => {
    const w = (allocations[a.id] || 0) / 100;
    ret += w * a.expReturn;
    riskSq += w * w * a.risk * a.risk;
    yld += w * a.yield;
    mer += w * a.mer;
  });
  const risk = Math.sqrt(riskSq) * 0.82;
  const sharpe = risk > 0 ? (ret - 0.04) / risk : 0;
  return { ret, risk, yld, mer, sharpe };
}

// ─── Components ─────────────────────────────────────────────
const Panel = ({ children, style }) => (
  <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, ...style }}>{children}</div>
);
const Label = ({ children }) => (
  <div style={{ fontSize: 10, color: C.dim, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>{children}</div>
);
const Badge = ({ text, color }) => (
  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, color, background: color + "15", border: `1px solid ${color}25` }}>{text}</span>
);

// Donut
const Donut = ({ allocations, size = 170 }) => {
  const active = ASSETS.filter(a => (allocations[a.id] || 0) > 0);
  const total = active.reduce((s, a) => s + (allocations[a.id] || 0), 0) || 1;
  let cum = -90;
  const r = size / 2 - 8, ir = r * 0.58;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {active.map(asset => {
        const pct = (allocations[asset.id] || 0) / total;
        const ang = pct * 360;
        const sa = cum, ea = cum + ang;
        cum = ea;
        const la = ang > 180 ? 1 : 0;
        const c = (a) => [Math.cos(a * Math.PI / 180), Math.sin(a * Math.PI / 180)];
        const [sx, sy] = c(sa), [ex, ey] = c(ea);
        const cx = size / 2, cy = size / 2;
        const d = `M${cx+ir*sx},${cy+ir*sy} L${cx+r*sx},${cy+r*sy} A${r},${r} 0 ${la} 1 ${cx+r*ex},${cy+r*ey} L${cx+ir*ex},${cy+ir*ey} A${ir},${ir} 0 ${la} 0 ${cx+ir*sx},${cy+ir*sy}`;
        return <path key={asset.id} d={d} fill={asset.color} opacity={0.8} />;
      })}
      <circle cx={size/2} cy={size/2} r={ir-2} fill={C.panel} />
    </svg>
  );
};

// Projection chart
const ProjectionChart = ({ initial, annual, contrib, years = 25, w = 520, h = 180 }) => {
  const pad = { t: 10, r: 10, b: 24, l: 50 };
  const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
  const scenarios = [
    { label: "Bull", mult: 1.35, color: C.green },
    { label: "Base", mult: 1.0, color: C.accent },
    { label: "Bear", mult: 0.6, color: C.red },
  ];
  const allData = scenarios.map(s => {
    const pts = []; let v = initial;
    for (let y = 0; y <= years; y++) { pts.push({ y, v }); v = v * (1 + annual * s.mult) + contrib; }
    return { ...s, pts };
  });
  const maxV = Math.max(...allData.flatMap(d => d.pts.map(p => p.v)));
  const x = (yr) => pad.l + (yr / years) * cw;
  const y = (v) => pad.t + ch - (v / maxV) * ch;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`}>
      {[0, 0.5, 1].map((f, i) => (
        <g key={i}>
          <line x1={pad.l} y1={pad.t + ch * (1-f)} x2={w-pad.r} y2={pad.t + ch * (1-f)} stroke={C.border} strokeDasharray="2,3" />
          <text x={pad.l-4} y={pad.t + ch * (1-f) + 3} fill={C.dim} fontSize="8" textAnchor="end" fontFamily="monospace">${(maxV*f/1e6).toFixed(1)}M</text>
        </g>
      ))}
      {allData.map(s => {
        const d = s.pts.map((p, i) => `${i===0?"M":"L"}${x(p.y)},${y(p.v)}`).join(" ");
        const last = s.pts[s.pts.length-1];
        return (
          <g key={s.label}>
            <path d={d} fill="none" stroke={s.color} strokeWidth="2" opacity="0.8" />
            <text x={x(years)+4} y={y(last.v)+3} fill={s.color} fontSize="8" fontWeight="700">{s.label}: ${(last.v/1e6).toFixed(2)}M</text>
          </g>
        );
      })}
      {[0,5,10,15,20,25].filter(yr=>yr<=years).map(yr => (
        <text key={yr} x={x(yr)} y={h-4} fill={C.dim} fontSize="7" textAnchor="middle">{yr}yr</text>
      ))}
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════
export default function PortfolioRebalancer() {
  const [profile, setProfile] = useState("balanced");
  const [holdings, setHoldings] = useState({
    xiu: { shares: 150, price: 36.50 },
    vfv: { shares: 80, price: 128.40 },
    xef: { shares: 100, price: 38.20 },
    xec: { shares: 60, price: 28.90 },
    zag: { shares: 200, price: 14.80 },
    zre: { shares: 50, price: 19.60 },
    cgl: { shares: 0, price: 22.10 },
    cash: { shares: 100, price: 50.05 },
  });
  const [annualContrib, setAnnualContrib] = useState(7000);
  const [activeTab, setActiveTab] = useState("portfolio");
  const [animate, setAnimate] = useState(false);

  useEffect(() => { setTimeout(() => setAnimate(true), 80); }, []);

  // Compute portfolio value and weights
  const portfolio = useMemo(() => {
    let total = 0;
    const positions = ASSETS.map(a => {
      const h = holdings[a.id] || { shares: 0, price: 0 };
      const value = h.shares * h.price;
      total += value;
      return { ...a, shares: h.shares, price: h.price, value };
    });
    positions.forEach(p => { p.weight = total > 0 ? (p.value / total) * 100 : 0; });
    const allocations = {};
    positions.forEach(p => { allocations[p.id] = Math.round(p.weight * 10) / 10; });
    const stats = calcPortfolioStats(allocations);
    const target = MODEL_PORTFOLIOS[profile].target;
    const targetStats = calcPortfolioStats(target);
    return { positions, total, allocations, stats, target, targetStats };
  }, [holdings, profile]);

  // Rebalancing trades
  const trades = useMemo(() => {
    return portfolio.positions.map(p => {
      const targetPct = portfolio.target[p.id] || 0;
      const targetValue = (targetPct / 100) * portfolio.total;
      const currentValue = p.value;
      const diff = targetValue - currentValue;
      const shares = p.price > 0 ? Math.round(diff / p.price) : 0;
      return { ...p, targetPct, targetValue, diff, tradeDollars: diff, tradeShares: shares, action: diff > 50 ? "BUY" : diff < -50 ? "SELL" : "HOLD" };
    }).filter(t => Math.abs(t.diff) > 50);
  }, [portfolio]);

  const updateHolding = (assetId, field, value) => {
    setHoldings(prev => ({ ...prev, [assetId]: { ...prev[assetId], [field]: parseFloat(value) || 0 } }));
  };

  const tabs = [
    { id: "portfolio", label: "My Portfolio" },
    { id: "rebalance", label: "Rebalance" },
    { id: "tax", label: "Tax Strategy" },
    { id: "projection", label: "Projection" },
  ];

  return (
    <div style={{ fontFamily: "'Segoe UI', -apple-system, sans-serif", background: C.bg, color: C.text, minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: ${C.bg}; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        input:focus { outline: none; border-color: ${C.accent} !important; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .anim { animation: fadeIn 0.4s ease forwards; opacity: 0; }
      `}</style>

      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: `linear-gradient(135deg, ${C.accent}, ${C.cyan})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: "#060910" }}>PR</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.5px" }}>PORTFOLIO REBALANCER</div>
            <div style={{ fontSize: 9, color: C.dim, letterSpacing: "1.5px" }}>CANADIAN INVESTMENT OPTIMIZER · TFSA · RRSP · FHSA</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.accent, fontFamily: "monospace", fontWeight: 700 }}>
          Portfolio: ${portfolio.total.toLocaleString(undefined, { maximumFractionDigits: 0 })} CAD
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, padding: "10px 24px 0", borderBottom: `1px solid ${C.border}`, overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: "7px 16px", fontSize: 11, fontWeight: 700, cursor: "pointer",
            background: activeTab === t.id ? C.accentDim : "transparent",
            color: activeTab === t.id ? C.accent : C.dim, border: "none",
            borderBottom: activeTab === t.id ? `2px solid ${C.accent}` : "2px solid transparent",
            borderRadius: "6px 6px 0 0", letterSpacing: "0.3px",
          }}>{t.label.toUpperCase()}</button>
        ))}
      </div>

      <div style={{ padding: "20px 24px", maxWidth: 1200, margin: "0 auto" }}>

        {/* ─── PORTFOLIO TAB ─── */}
        {activeTab === "portfolio" && (
          <div className={animate ? "anim" : ""}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
              Enter your actual holdings below — shares and current price per share. The tool calculates your allocation and compares it to your target.
            </div>

            {/* Risk Profile Selector */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {Object.entries(MODEL_PORTFOLIOS).map(([key, mp]) => (
                <button key={key} onClick={() => setProfile(key)} style={{
                  padding: "8px 16px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
                  background: profile === key ? mp.color + "18" : "transparent",
                  color: profile === key ? mp.color : C.dim,
                  border: `1px solid ${profile === key ? mp.color + "40" : C.border}`,
                }}>{mp.label.toUpperCase()}</button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, fontStyle: "italic" }}>{MODEL_PORTFOLIOS[profile].desc}</div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Portfolio Value", value: "$" + portfolio.total.toLocaleString(undefined, {maximumFractionDigits: 0}), color: C.accent },
                { label: "Expected Return", value: (portfolio.stats.ret * 100).toFixed(1) + "%", color: C.green },
                { label: "Risk (Volatility)", value: (portfolio.stats.risk * 100).toFixed(1) + "%", color: portfolio.stats.risk > 0.14 ? C.amber : C.accent },
                { label: "Sharpe Ratio", value: portfolio.stats.sharpe.toFixed(2), color: portfolio.stats.sharpe > 0.4 ? C.accent : C.amber },
                { label: "Dividend Yield", value: portfolio.stats.yld.toFixed(1) + "%", color: C.blue },
                { label: "Blended MER", value: portfolio.stats.mer.toFixed(2) + "%", color: portfolio.stats.mer < 0.2 ? C.green : C.amber },
              ].map((m, i) => (
                <Panel key={i}>
                  <Label>{m.label}</Label>
                  <div style={{ fontSize: 20, fontWeight: 800, color: m.color, fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>{m.value}</div>
                </Panel>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14, marginBottom: 16 }}>
              {/* Holdings Input */}
              <Panel>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, letterSpacing: "1px", marginBottom: 12, textTransform: "uppercase" }}>Your Holdings — Edit shares & prices</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["ETF", "Shares", "Price", "Value", "Weight", "Target"].map(h => (
                          <th key={h} style={{ textAlign: h === "ETF" ? "left" : "right", padding: "6px 8px", fontSize: 9, color: C.dim, borderBottom: `1px solid ${C.border}`, letterSpacing: "0.5px" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.positions.map(p => {
                        const targetPct = portfolio.target[p.id] || 0;
                        const diff = p.weight - targetPct;
                        return (
                          <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}08` }}>
                            <td style={{ padding: "8px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{p.ticker}</div>
                                  <div style={{ fontSize: 9, color: C.dim }}>{p.name}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: "4px 8px", textAlign: "right" }}>
                              <input type="number" value={p.shares} onChange={e => updateHolding(p.id, "shares", e.target.value)}
                                style={{ width: 60, padding: "4px 6px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 11, fontFamily: "monospace", textAlign: "right" }} />
                            </td>
                            <td style={{ padding: "4px 8px", textAlign: "right" }}>
                              <input type="number" step="0.01" value={p.price} onChange={e => updateHolding(p.id, "price", e.target.value)}
                                style={{ width: 72, padding: "4px 6px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 11, fontFamily: "monospace", textAlign: "right" }} />
                            </td>
                            <td style={{ padding: "8px", textAlign: "right", fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: C.text }}>${p.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td style={{ padding: "8px", textAlign: "right" }}>
                              <span style={{ fontSize: 11, fontFamily: "monospace", color: Math.abs(diff) > 5 ? C.amber : C.text }}>{p.weight.toFixed(1)}%</span>
                            </td>
                            <td style={{ padding: "8px", textAlign: "right", fontSize: 11, fontFamily: "monospace", color: C.accent }}>{targetPct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>

              {/* Donut + Legend */}
              <Panel>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, letterSpacing: "1px", marginBottom: 12, textTransform: "uppercase" }}>Allocation Breakdown</div>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                  <Donut allocations={portfolio.allocations} />
                  <div>
                    {portfolio.positions.filter(p => p.value > 0).map(p => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
                        <span style={{ fontSize: 10, color: C.muted, minWidth: 60 }}>{p.ticker}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: p.color, fontFamily: "monospace" }}>{p.weight.toFixed(1)}%</span>
                      </div>
                    ))}
                    <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 8, display: "flex", gap: 16 }}>
                      <div><Label>Equity</Label><div style={{ fontSize: 14, fontWeight: 700, color: C.blue, fontFamily: "monospace" }}>{portfolio.positions.filter(p => p.category === "Equity").reduce((s, p) => s + p.weight, 0).toFixed(0)}%</div></div>
                      <div><Label>Fixed Inc</Label><div style={{ fontSize: 14, fontWeight: 700, color: C.green, fontFamily: "monospace" }}>{portfolio.positions.filter(p => p.category === "Fixed Income").reduce((s, p) => s + p.weight, 0).toFixed(0)}%</div></div>
                      <div><Label>Other</Label><div style={{ fontSize: 14, fontWeight: 700, color: C.amber, fontFamily: "monospace" }}>{portfolio.positions.filter(p => !["Equity","Fixed Income"].includes(p.category)).reduce((s, p) => s + p.weight, 0).toFixed(0)}%</div></div>
                    </div>
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        )}

        {/* ─── REBALANCE TAB ─── */}
        {activeTab === "rebalance" && (
          <div className={animate ? "anim" : ""}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
              Based on your current holdings and the <strong style={{ color: MODEL_PORTFOLIOS[profile].color }}>{MODEL_PORTFOLIOS[profile].label}</strong> target, here are the trades needed to rebalance your portfolio.
            </div>

            {trades.length === 0 ? (
              <Panel style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>Portfolio is balanced</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>No trades needed — your allocation matches the target.</div>
              </Panel>
            ) : (
              <Panel>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, letterSpacing: "1px", marginBottom: 12, textTransform: "uppercase" }}>Rebalancing Trades — {MODEL_PORTFOLIOS[profile].label} Target</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                    <thead>
                      <tr>
                        {["ETF", "Current %", "Target %", "Drift", "Action", "Shares", "Amount (CAD)"].map(h => (
                          <th key={h} style={{ textAlign: h === "ETF" ? "left" : "right", padding: "8px 10px", fontSize: 9, color: C.dim, borderBottom: `1px solid ${C.border}`, letterSpacing: "0.5px" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map(t => (
                        <tr key={t.id} style={{ borderBottom: `1px solid ${C.border}08` }}>
                          <td style={{ padding: "10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 8, height: 8, borderRadius: 2, background: t.color }} />
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{t.ticker}</div>
                                <div style={{ fontSize: 9, color: C.dim }}>{t.name}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "10px", textAlign: "right", fontSize: 12, fontFamily: "monospace", color: C.muted }}>{t.weight.toFixed(1)}%</td>
                          <td style={{ padding: "10px", textAlign: "right", fontSize: 12, fontFamily: "monospace", color: C.accent }}>{t.targetPct}%</td>
                          <td style={{ padding: "10px", textAlign: "right", fontSize: 12, fontFamily: "monospace", color: t.diff > 0 ? C.green : C.red, fontWeight: 700 }}>
                            {t.diff > 0 ? "+" : ""}{(t.weight - t.targetPct).toFixed(1)}%
                          </td>
                          <td style={{ padding: "10px", textAlign: "right" }}>
                            <Badge text={t.action} color={t.action === "BUY" ? C.green : C.red} />
                          </td>
                          <td style={{ padding: "10px", textAlign: "right", fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: C.text }}>
                            {t.action === "BUY" ? "+" : ""}{t.tradeShares} units
                          </td>
                          <td style={{ padding: "10px", textAlign: "right", fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: t.diff > 0 ? C.green : C.red }}>
                            {t.diff > 0 ? "+" : ""}${Math.abs(t.tradeDollars).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 16, padding: "12px", background: C.surface, borderRadius: 6, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                  <strong style={{ color: C.amber }}>Note:</strong> Consider executing trades in tax-advantaged accounts first (TFSA/RRSP) to minimize tax impact. If selling in a non-registered account, be aware of capital gains implications. Trade amounts are approximate — adjust for actual bid/ask prices.
                </div>
              </Panel>
            )}
          </div>
        )}

        {/* ─── TAX STRATEGY TAB ─── */}
        {activeTab === "tax" && (
          <div className={animate ? "anim" : ""}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
              Where you hold each asset matters as much as what you hold. Proper asset location across your registered and non-registered accounts can save thousands in taxes over your investing lifetime.
            </div>

            {/* Account overview */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12, marginBottom: 18 }}>
              {ACCOUNTS.map(acct => (
                <Panel key={acct.id} style={{ borderLeft: `3px solid ${acct.color}` }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: acct.color, marginBottom: 4 }}>{acct.name}</div>
                  {acct.limit && <div style={{ fontSize: 11, color: C.muted }}>2026 Limit: <strong style={{ color: C.text }}>${acct.limit.toLocaleString()}</strong></div>}
                  {acct.cumLimit && <div style={{ fontSize: 11, color: C.muted }}>Cumulative Room: <strong style={{ color: C.text }}>${acct.cumLimit.toLocaleString()}</strong></div>}
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>{acct.reason}</div>
                  <div style={{ marginTop: 10, fontSize: 10, fontWeight: 700, color: C.dim, letterSpacing: "0.5px", textTransform: "uppercase" }}>Best assets for this account:</div>
                  {acct.bestFor.map((item, i) => (
                    <div key={i} style={{ fontSize: 11, color: C.text, paddingLeft: 12, marginTop: 4, position: "relative" }}>
                      <span style={{ position: "absolute", left: 0, color: acct.color }}>›</span>{item}
                    </div>
                  ))}
                </Panel>
              ))}
            </div>

            {/* Per-asset advice */}
            <Panel>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, letterSpacing: "1px", marginBottom: 14, textTransform: "uppercase" }}>Asset-by-Asset Tax Placement Guide</div>
              {ASSETS.map(asset => {
                const bestAcct = asset.id === "vfv" ? "RRSP" : asset.id === "xiu" ? "Non-Reg" : asset.id === "zag" || asset.id === "zre" ? "TFSA/RRSP" : "TFSA";
                const bestColor = asset.id === "vfv" ? C.blue : asset.id === "xiu" ? C.amber : C.accent;
                return (
                  <div key={asset.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}08`, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 150 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: asset.color }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{asset.ticker}</div>
                        <div style={{ fontSize: 10, color: C.dim }}>{asset.name}</div>
                      </div>
                    </div>
                    <Badge text={"Best: " + bestAcct} color={bestColor} />
                    <div style={{ fontSize: 11, color: C.muted, flex: 1, minWidth: 200, textAlign: "right" }}>{asset.taxNote}</div>
                  </div>
                );
              })}
            </Panel>
          </div>
        )}

        {/* ─── PROJECTION TAB ─── */}
        {activeTab === "projection" && (
          <div className={animate ? "anim" : ""}>
            <div style={{ display: "flex", gap: 16, marginBottom: 18, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div>
                <Label>Current Portfolio</Label>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.accent, fontFamily: "monospace" }}>${portfolio.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div>
                <Label>Annual Contribution</Label>
                <input type="number" value={annualContrib} onChange={e => setAnnualContrib(parseInt(e.target.value) || 0)}
                  style={{ padding: "8px 12px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontFamily: "monospace", fontSize: 14, width: 130 }} />
              </div>
              <div>
                <Label>Expected Annual Return</Label>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.green, fontFamily: "monospace" }}>{(portfolio.stats.ret * 100).toFixed(1)}%</div>
              </div>
            </div>

            <Panel style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, letterSpacing: "1px", marginBottom: 12, textTransform: "uppercase" }}>25-Year Wealth Projection — Three Scenarios</div>
              <ProjectionChart initial={portfolio.total} annual={portfolio.stats.ret} contrib={annualContrib} />
            </Panel>

            {/* Year table */}
            <Panel>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, letterSpacing: "1px", marginBottom: 12, textTransform: "uppercase" }}>Year-by-Year Breakdown (Base Case)</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Year", "Start Value", "Contributions", "Investment Growth", "End Value", "Dividend Income"].map(h => (
                        <th key={h} style={{ textAlign: "right", padding: "6px 10px", fontSize: 9, color: C.dim, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const rows = []; let v = portfolio.total;
                      for (let y = 1; y <= 25; y++) {
                        const growth = v * portfolio.stats.ret;
                        const divIncome = v * portfolio.stats.yld / 100;
                        const end = v + growth + annualContrib;
                        rows.push(
                          <tr key={y} style={{ borderBottom: `1px solid ${C.border}08`, background: y % 5 === 0 ? C.surface : "transparent" }}>
                            <td style={{ padding: "6px 10px", fontSize: 11, color: C.muted, textAlign: "right", fontWeight: y % 5 === 0 ? 700 : 400 }}>{y}</td>
                            <td style={{ padding: "6px 10px", fontSize: 11, fontFamily: "monospace", color: C.text, textAlign: "right" }}>${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td style={{ padding: "6px 10px", fontSize: 11, fontFamily: "monospace", color: C.blue, textAlign: "right" }}>+${annualContrib.toLocaleString()}</td>
                            <td style={{ padding: "6px 10px", fontSize: 11, fontFamily: "monospace", color: C.green, textAlign: "right" }}>+${growth.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td style={{ padding: "6px 10px", fontSize: 11, fontFamily: "monospace", color: C.accent, textAlign: "right", fontWeight: 700 }}>${end.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td style={{ padding: "6px 10px", fontSize: 11, fontFamily: "monospace", color: C.amber, textAlign: "right" }}>${divIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr</td>
                          </tr>
                        );
                        v = end;
                      }
                      return rows;
                    })()}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        )}

        <div style={{ textAlign: "center", padding: "24px 0 12px", fontSize: 10, color: C.dim, letterSpacing: "1px" }}>
          PORTFOLIO REBALANCER · CANADIAN INVESTMENT OPTIMIZER · ZERO API DEPENDENCIES · KARTIK JOSHI
        </div>
      </div>
    </div>
  );
}
