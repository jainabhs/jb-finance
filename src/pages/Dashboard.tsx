import { useMemo } from "react";
import {
  Wallet,
  Activity,
  CheckCircle2,
  ArrowUpRight,
  BookOpen,
  UserPlus,
  Clock,
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
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
        .slice(0, 8),
    [interests],
  );

  // Portfolio: principal outstanding per borrower
  const portfolio = useMemo(() => {
    const map = new Map<string, { name: string; principal: number; loanCount: number }>();
    for (const l of activeLoans) {
      const b = borrowers.find((x) => x.id === l.borrowerId);
      const name = b?.fullName || "Unknown";
      const existing = map.get(l.borrowerId) || { name, principal: 0, loanCount: 0 };
      existing.principal += l.principal;
      existing.loanCount += 1;
      map.set(l.borrowerId, existing);
    }
    return [...map.values()].sort((a, b) => b.principal - a.principal).slice(0, 5);
  }, [activeLoans, borrowers]);

  const stats = [
    {
      label: "Active Loans",
      value: activeLoans.length.toString(),
      icon: Wallet,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Principal Out",
      value: m(totalPrincipal),
      icon: Activity,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Pending",
      value: m(totalPending, { decimals: 0 }),
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "Collected",
      value: m(totalCollected),
      icon: CheckCircle2,
      color: "text-sky-600 dark:text-sky-400",
      bg: "bg-sky-500/10",
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          Dashboard
        </h2>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 tracking-wide">
          Portfolio overview
        </p>
      </div>

      {/* Stats 2x2 mobile, 4-col desktop */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35 }}
            className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/50 rounded-2xl p-4 sm:p-5"
          >
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon className={`w-[18px] h-[18px] ${s.color}`} />
            </div>
            <p
              className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight leading-none truncate"
              title={s.value}
            >
              {s.value}
            </p>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1.5">
              {s.label}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link
          to="/loans"
          className="flex-1 bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/50 rounded-2xl p-4 flex items-center gap-3 hover:border-sky-300 dark:hover:border-sky-600/50 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center shrink-0 group-hover:bg-sky-500 transition-colors">
            <Wallet className="w-5 h-5 text-sky-600 dark:text-sky-400 group-hover:text-white transition-colors" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 block truncate">
              New Loan
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">Record a loan</span>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-300 dark:text-slate-600 ml-auto shrink-0" />
        </Link>
        <Link
          to="/interest"
          className="flex-1 bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/50 rounded-2xl p-4 flex items-center gap-3 hover:border-emerald-300 dark:hover:border-emerald-600/50 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-500 transition-colors">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 group-hover:text-white transition-colors" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 block truncate">
              Interest
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">Calculate</span>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-300 dark:text-slate-600 ml-auto shrink-0" />
        </Link>
        <Link
          to="/borrowers"
          className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/50 rounded-2xl p-4 flex items-center justify-center hover:border-violet-300 dark:hover:border-violet-600/50 transition-all group shrink-0"
        >
          <UserPlus className="w-5 h-5 text-violet-500 dark:text-violet-400 group-hover:scale-110 transition-transform" />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Portfolio Exposure */}
        <div className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/50 rounded-2xl p-4 sm:p-5">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-violet-500" /> Exposure by Borrower
          </h3>
          {portfolio.length > 0 ? (
            <div className="space-y-2.5">
              {portfolio.map((entry) => {
                const pct = totalPrincipal > 0 ? (entry.principal / totalPrincipal) * 100 : 0;
                return (
                  <div key={entry.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                        {entry.name}
                      </span>
                      <span className="text-xs font-black text-slate-900 dark:text-white font-mono ml-2 shrink-0">
                        {m(entry.principal)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-violet-500 to-sky-500 rounded-full"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {entry.loanCount} loan{entry.loanCount > 1 ? "s" : ""} · {pct.toFixed(0)}% of
                      portfolio
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-xs text-slate-400 dark:text-slate-500">No active loans</p>
            </div>
          )}
        </div>

        {/* Recent Collections */}
        <div className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/50 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Recent Activity
            </h3>
            <Link
              to="/history"
              className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest hover:text-sky-700 dark:hover:text-sky-300"
            >
              View All
            </Link>
          </div>
          <div className="space-y-1">
            {recentInterests.map((interest) => {
              const loan = loans.find((l) => l.id === interest.loanId);
              const borrower = borrowers.find((b) => b.id === loan?.borrowerId);
              return (
                <div
                  key={interest.id}
                  className="flex items-center justify-between py-2.5 border-b border-slate-100 dark:border-slate-700/30 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                      {borrower?.fullName || "Unknown"}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                      {loan?.collateralCode || "—"} ·{" "}
                      {new Date(interest.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono ml-3 shrink-0">
                    +{m(interest.amount)}
                  </span>
                </div>
              );
            })}
            {recentInterests.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  No collections recorded yet
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
