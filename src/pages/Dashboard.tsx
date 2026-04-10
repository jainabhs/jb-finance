import { useMemo } from "react";
import {
  Wallet,
  Activity,
  CheckCircle2,
  ArrowUpRight,
  BookOpen,
  Clock,
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useMockData } from "../lib/MockContext";
import { usePrivacy } from "../lib/PrivacyContext";

import { calculateCompoundInterest } from "../lib/interest";

export default function Dashboard() {
  const { loans, borrowers, interests } = useMockData();
  const { m } = usePrivacy();
  const activeLoans = loans.filter((l) => l.status === "active");
  const totalPrincipal = activeLoans.reduce((s, l) => s + l.principal, 0);
  const totalCollected = interests.reduce((s, i) => s + i.amount, 0);
  const totalPending = useMemo(
    () =>
      activeLoans.reduce((s, l) => {
        const start = new Date(l.lastPaymentDate);
        const now = new Date();
        if (now <= start) return s;
        return (
          s +
          calculateCompoundInterest(l.principal, l.rate, start, now, Math.max(1, l.thresholdMonths))
            .totalInterest
        );
      }, 0),
    [activeLoans],
  );

  const recentInterests = useMemo(
    () =>
      [...interests]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    [interests],
  );

  // Portfolio: principal outstanding per borrower + earned
  const portfolio = useMemo(() => {
    const map = new Map<string, { name: string; principal: number; loanCount: number; earned: number }>();
    for (const l of activeLoans) {
      const b = borrowers.find((x) => x.id === l.borrowerId);
      const name = b?.fullName || "Unknown";
      const existing = map.get(l.borrowerId) || { name, principal: 0, loanCount: 0, earned: 0 };
      existing.principal += l.principal;
      existing.loanCount += 1;
      existing.earned += interests.filter((i) => i.loanId === l.id).reduce((s, i) => s + i.amount, 0);
      map.set(l.borrowerId, existing);
    }
    return [...map.values()].sort((a, b) => b.principal - a.principal).slice(0, 5);
  }, [activeLoans, borrowers, interests]);

  const overallYield = totalPrincipal > 0 ? (totalCollected / totalPrincipal) * 100 : 0;
  const monthlyEarning = activeLoans.reduce((s, l) => s + (l.principal * l.rate / 100), 0);
  const effectiveRate = totalPrincipal > 0 ? (monthlyEarning / totalPrincipal) * 100 : 0;

  // Capital by interest rate
  const rateBreakdown = useMemo(() => {
    const map = new Map<number, number>();
    for (const l of activeLoans) {
      map.set(l.rate, (map.get(l.rate) || 0) + l.principal);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([rate, principal]) => ({
      rate,
      principal,
      pct: totalPrincipal > 0 ? (principal / totalPrincipal) * 100 : 0,
    }));
  }, [activeLoans, totalPrincipal]);

  // Collateral distribution
  const collateralBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; principal: number }>();
    for (const l of activeLoans) {
      const type = l.collateralType || "Other";
      const existing = map.get(type) || { count: 0, principal: 0 };
      existing.count += 1;
      existing.principal += l.principal;
      map.set(type, existing);
    }
    return [...map.entries()].sort((a, b) => b[1].principal - a[1].principal);
  }, [activeLoans]);

  // Recent loans
  const recentLoans = useMemo(() =>
    [...loans]
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      .slice(0, 4),
    [loans],
  );

  // Short number format: 5,00,000 → 5L, 1,20,00,000 → 1.2Cr
  const short = (n: number) => {
    if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1).replace(/\.0$/, "")}Cr`;
    if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1).replace(/\.0$/, "")}L`;
    if (n >= 1_000) return `₹${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
    return `₹${Math.round(n)}`;
  };

  // 5-year growth projection (if earnings reinvested at same rate)
  const projection = useMemo(() => {
    if (totalPrincipal <= 0 || effectiveRate <= 0) return [];
    const monthlyRate = effectiveRate / 100;
    const points = [];
    for (let year = 0; year <= 5; year++) {
      const months = year * 12;
      const value = totalPrincipal * Math.pow(1 + monthlyRate, months);
      const earned = value - totalPrincipal;
      points.push({ year, value, earned });
    }
    return points;
  }, [totalPrincipal, effectiveRate]);

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── Greeting ── */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          {greeting}
        </h2>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          {format(new Date(), "EEEE, dd MMM yyyy")}
        </p>
      </div>

      {/* ── Hero: Total + Estimations ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white font-mono tracking-tight leading-none">{m(totalPrincipal)}</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              given across {activeLoans.length} loan{activeLoans.length !== 1 ? "s" : ""} · avg <span className="font-semibold text-sky-600 dark:text-sky-400">{effectiveRate.toFixed(1)}%/mo</span>
            </p>
          </div>
          <div className="flex gap-1.5 mb-1">
            <Link to="/loans" className="w-8 h-8 flex items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/30 transition-colors" title="Loans">
              <Wallet className="w-3.5 h-3.5" />
            </Link>
            <Link to="/interest" className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors" title="Interest">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-100 dark:border-emerald-800/30 rounded-xl px-3.5 py-3">
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mb-0.5">Expected Monthly Interest</p>
            <p className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-300 font-mono leading-none">{m(monthlyEarning, { decimals: 0 })}</p>
          </div>
          <div className="bg-sky-50 dark:bg-sky-900/15 border border-sky-100 dark:border-sky-800/30 rounded-xl px-3.5 py-3">
            <p className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold mb-0.5">Expected Yearly Interest</p>
            <p className="text-lg sm:text-xl font-black text-sky-700 dark:text-sky-300 font-mono leading-none">{m(monthlyEarning * 12, { decimals: 0 })}</p>
          </div>
        </div>
      </motion.div>

      {/* ── Money Given Per Person ── */}
      {portfolio.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2.5">Money Given Per Person</h3>
          <div className="space-y-2">
            {portfolio.map((entry) => {
              const pct = totalPrincipal > 0 ? (entry.principal / totalPrincipal) * 100 : 0;
              return (
                <div key={entry.name} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-sky-400 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-black text-white">{entry.name.split(" ").map(w => w[0]).join("").slice(0, 2)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{entry.name}</span>
                      <span className="text-xs font-black text-slate-900 dark:text-white font-mono ml-2 shrink-0">{m(entry.principal)}</span>
                    </div>
                    <div className="h-1 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-violet-500 to-sky-500 rounded-full"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {entry.loanCount} loan{entry.loanCount > 1 ? "s" : ""} · {pct.toFixed(0)}%{entry.earned > 0 && <> · earned {m(entry.earned)}</>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Rate + Collateral row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {rateBreakdown.length > 0 && (
          <div className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/50 rounded-2xl p-4 sm:p-5">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Money at Each Rate</h3>
            <div className="space-y-3">
              {rateBreakdown.map(({ rate, principal, pct }) => (
                <div key={rate} className="flex items-center gap-3">
                  <span className="text-sm font-black text-sky-600 dark:text-sky-400 font-mono w-12 shrink-0">{rate}%</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          className="h-full bg-gradient-to-r from-sky-400 to-blue-500 rounded-full"
                        />
                      </div>
                      <span className="text-xs font-black text-slate-900 dark:text-white font-mono shrink-0">{m(principal)}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">earns {m(principal * rate / 100, { decimals: 0 })}/mo</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {collateralBreakdown.length > 0 && (
          <div className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/50 rounded-2xl p-4 sm:p-5">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Secured By</h3>
            <div className="space-y-2.5">
              {collateralBreakdown.map(([type, { count, principal }]) => {
                const pct = totalPrincipal > 0 ? (principal / totalPrincipal) * 100 : 0;
                return (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${type === "Gold" ? "bg-amber-400" : type === "Property" ? "bg-emerald-400" : type === "Vehicle" ? "bg-orange-400" : "bg-slate-400"}`} />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{type}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-slate-900 dark:text-white font-mono">{m(principal)}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1.5">{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Growth Projection ── */}
      {projection.length > 0 && (() => {
        const maxVal = projection[projection.length - 1].value;
        const chartW = 100;
        const chartH = 40;
        const padTop = 4;
        const padBottom = 2;
        const usableH = chartH - padTop - padBottom;

        const points = projection.map((p, i) => {
          const x = (i / (projection.length - 1)) * chartW;
          const y = padTop + usableH - ((p.value - totalPrincipal) / (maxVal - totalPrincipal)) * usableH;
          return { x, y, ...p };
        });

        const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
        const areaPath = `${linePath} L${chartW},${chartH} L0,${chartH} Z`;

        return (
          <div className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/50 rounded-2xl p-4 sm:p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">If You Reinvest Earnings</h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">5-year projection at current {effectiveRate.toFixed(1)}%/mo rate</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 dark:text-slate-500">Year 5</p>
                <p className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono leading-none">{short(projection[5]?.value ?? 0)}</p>
              </div>
            </div>

            {/* SVG Chart */}
            <div className="relative">
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-32 sm:h-40" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(16,185,129)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="rgb(16,185,129)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {/* Grid lines */}
                {[1, 2, 3, 4].map((i) => (
                  <line key={i} x1="0" y1={padTop + (usableH / 4) * i} x2={chartW} y2={padTop + (usableH / 4) * i} stroke="currentColor" className="text-slate-100 dark:text-slate-700/40" strokeWidth="0.3" />
                ))}
                {/* Area fill */}
                <path d={areaPath} fill="url(#projGrad)" />
                {/* Line */}
                <path d={linePath} fill="none" stroke="rgb(16,185,129)" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
                {/* Dots */}
                {points.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 0.8 : 1.2} fill={i === 0 ? "rgb(148,163,184)" : "rgb(16,185,129)"} />
                ))}
              </svg>

              {/* Year labels */}
              <div className="flex justify-between mt-1 px-0.5">
                {projection.map((p) => (
                  <span key={p.year} className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">
                    {p.year === 0 ? "Now" : `${new Date().getFullYear() + p.year}`}
                  </span>
                ))}
              </div>
            </div>

            {/* Milestones */}
            <div className="grid grid-cols-5 gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/40">
              {projection.slice(1).map((p) => (
                <div key={p.year} className="text-center">
                  <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white font-mono leading-none">{short(p.value)}</p>
                  <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">+{short(p.earned)}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Recent Activity + Recent Loans ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/50 rounded-2xl p-4 sm:p-5">
          <Link to="/history" className="flex items-center justify-between mb-3 group">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Recent Activity</h3>
            <ArrowUpRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-sky-500 transition-colors" />
          </Link>
          <div className="space-y-1">
            {recentInterests.map((interest) => {
              const loan = loans.find((l) => l.id === interest.loanId);
              const borrower = borrowers.find((b) => b.id === loan?.borrowerId);
              return (
                <div key={interest.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/30 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{borrower?.fullName || "Unknown"}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                      {loan?.collateralCode || "—"} · {new Date(interest.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono ml-3 shrink-0">+{m(interest.amount)}</span>
                </div>
              );
            })}
            {recentInterests.length === 0 && (
              <div className="py-6 text-center">
                <p className="text-xs text-slate-400 dark:text-slate-500">No collections recorded yet</p>
              </div>
            )}
          </div>
        </div>

        {recentLoans.length > 0 && (
          <div className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/50 rounded-2xl p-4 sm:p-5">
            <Link to="/loans" className="flex items-center justify-between mb-3 group">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Recent Loans</h3>
              <ArrowUpRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-sky-500 transition-colors" />
            </Link>
            <div className="space-y-1">
              {recentLoans.map((l) => {
                const b = borrowers.find((x) => x.id === l.borrowerId);
                return (
                  <div key={l.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/30 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{b?.fullName || "Unknown"}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                        {l.collateralCode || "—"} · {format(new Date(l.startDate), "dd MMM yy")} · {l.rate}%
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <span className="text-sm font-black text-slate-900 dark:text-white font-mono">{m(l.principal)}</span>
                      {l.status === "closed" && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-400">CLOSED</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
