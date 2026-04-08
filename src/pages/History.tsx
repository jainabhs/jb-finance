import { useState, useMemo } from "react";
import {
  History as HistoryIcon,
  Search,
  CalendarDays,
  Wallet,
  Hash,
  Trash2,
  AlertOctagon,
  Lock,
  ChevronDown,
  Clock,
  Download,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMockData } from "../lib/MockContext";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { Select } from "../components/ui/Select";
import toast from "react-hot-toast";
import { usePrivacy } from "../lib/PrivacyContext";
import { shortId } from "../lib/utils";

export default function History() {
  const { loans, borrowers, interests, globalBorrowerId, deleteInterest } = useMockData();
  const { m } = usePrivacy();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialLoanId = searchParams.get("loanId") || "";
  const [selectedLoanId, setSelectedLoanId] = useState<string>(initialLoanId);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [expandedLoans, setExpandedLoans] = useState<Set<string>>(new Set());

  // When linked directly via ?loanId=, derive the borrower from the loan
  const linkedLoan = initialLoanId ? loans.find((l) => l.id === initialLoanId) : null;
  const effectiveBorrowerId = globalBorrowerId || linkedLoan?.borrowerId || null;

  const toggleLoanExpanded = (loanId: string) => {
    setExpandedLoans((prev) => {
      const next = new Set(prev);
      if (next.has(loanId)) next.delete(loanId);
      else next.add(loanId);
      return next;
    });
  };

  const globalBorrower = borrowers.find((b) => b.id === effectiveBorrowerId);

  const contextLoans = useMemo(() => {
    if (effectiveBorrowerId) return loans.filter((l) => l.borrowerId === effectiveBorrowerId);
    return loans;
  }, [loans, effectiveBorrowerId]);

  const allHistory = useMemo(() => {
    const contextLoanIds = new Set(contextLoans.map((l) => l.id));
    let filtered = interests.filter((i) => contextLoanIds.has(i.loanId));
    if (selectedLoanId) filtered = filtered.filter((i) => i.loanId === selectedLoanId);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((i) => {
        const loan = loans.find((l) => l.id === i.loanId);
        const borrower = loan ? borrowers.find((b) => b.id === loan.borrowerId) : null;
        return (
          i.loanId.toLowerCase().includes(q) ||
          borrower?.fullName.toLowerCase().includes(q) ||
          loan?.collateralCode?.toLowerCase().includes(q)
        );
      });
    }
    return filtered.sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
  }, [interests, contextLoans, selectedLoanId, searchQuery, loans, borrowers]);

  const totalCollected = useMemo(
    () => allHistory.reduce((sum, h) => sum + h.amount, 0),
    [allHistory],
  );
  const uniqueLoanCount = useMemo(
    () => new Set(allHistory.map((h) => h.loanId)).size,
    [allHistory],
  );

  const latestPerLoan = useMemo(() => {
    const map = new Map<string, string>();
    for (const loan of contextLoans) {
      const loanEntries = interests
        .filter((i) => i.loanId === loan.id)
        .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
      if (loanEntries.length > 0) map.set(loan.id, loanEntries[0].id);
    }
    return map;
  }, [interests, contextLoans]);

  const handleLoanFilterChange = (val: string) => {
    setSelectedLoanId(val);
    if (val) setSearchParams({ loanId: val });
    else setSearchParams({});
  };

  const groupedByLoan = useMemo(() => {
    if (selectedLoanId) return null;
    const groups = new Map<string, typeof allHistory>();
    for (const entry of allHistory) {
      const existing = groups.get(entry.loanId) || [];
      existing.push(entry);
      groups.set(entry.loanId, existing);
    }
    return groups;
  }, [allHistory, selectedLoanId]);

  const exportCSV = () => {
    if (allHistory.length === 0) return;
    const rows = [["Loan ID", "Borrower", "Period Start", "Period End", "Amount", "Logged"]];
    for (const h of allHistory) {
      const loan = loans.find((l) => l.id === h.loanId);
      const borrower = loan ? borrowers.find((b) => b.id === loan.borrowerId) : null;
      rows.push([
        h.loanId,
        borrower?.fullName || "Unknown",
        format(new Date(h.startDate), "yyyy-MM-dd"),
        format(new Date(h.endDate), "yyyy-MM-dd"),
        h.amount.toString(),
        new Date(h.createdAt).toLocaleDateString(),
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported!");
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Payment Ledger
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {globalBorrower
              ? `Collection history for ${globalBorrower.fullName}`
              : "Interest collection records"}
          </p>
        </div>
        {allHistory.length > 0 && (
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-sky-300 dark:hover:border-sky-600/50 hover:text-sky-600 dark:hover:text-sky-400 transition-all"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        )}
      </div>

      {/* ══════ Stats Strip ══════ */}
      <div className="grid grid-cols-3 gap-2">
        {[
          {
            label: "Collected",
            value: m(totalCollected),
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-500/10",
          },
          {
            label: "Records",
            value: allHistory.length.toString(),
            color: "text-sky-600 dark:text-sky-400",
            bg: "bg-sky-500/10",
          },
          {
            label: "Facilities",
            value: uniqueLoanCount.toString(),
            color: "text-violet-600 dark:text-violet-400",
            bg: "bg-violet-500/10",
          },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bg} rounded-xl p-3 sm:p-4`}>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1 truncate">
              {stat.label}
            </p>
            <p
              className={`text-base sm:text-lg font-black font-mono leading-none truncate ${stat.color}`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* ══════ Filters ══════ */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Select
            value={selectedLoanId}
            onChange={handleLoanFilterChange}
            options={[
              { value: "", label: "All Loans" },
              ...contextLoans.map((l) => {
                const b = borrowers.find((x) => x.id === l.borrowerId);
                return {
                  value: l.id,
                  label: `${shortId(l.id)} · ${b?.fullName || "Unknown"} · ₹${l.principal.toLocaleString("en-IN")}${l.status === "closed" ? " (Closed)" : ""}`,
                };
              }),
            ]}
            placeholder="Filter by loan..."
            icon={<Hash className="h-4 w-4 text-slate-400 dark:text-slate-500" />}
            buttonClassName="w-full bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl py-3 pl-4 pr-5 text-sm font-medium focus:ring-2 transition-all font-mono hover:border-sky-300 dark:hover:border-sky-600/50 focus:border-sky-500 focus:ring-sky-100 dark:focus:ring-sky-900/30"
          />
        </div>
        <div className="flex-1 relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 z-10">
            <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search loan, borrower, item code..."
            className="block w-full bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl py-3 pl-11 pr-4 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/30 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* ══════ Main Content ══════ */}
      <AnimatePresence mode="wait">
        {allHistory.length > 0 ? (
          selectedLoanId ? (
            /* ─── Single Loan Timeline ─── */
            <motion.div
              key="single"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Loan context banner */}
              {(() => {
                const loan = loans.find((l) => l.id === selectedLoanId);
                const borrower = loan ? borrowers.find((b) => b.id === loan.borrowerId) : null;
                const isClosed = loan?.status === "closed";
                return loan ? (
                  <div className="mb-6 rounded-2xl border border-gray-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-800/80 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                        style={{
                          background: isClosed
                            ? "linear-gradient(135deg, #64748b, #94a3b8)"
                            : "linear-gradient(135deg, #2563eb, #38bdf8)",
                        }}
                      >
                        {isClosed ? (
                          <Lock className="w-5 h-5 text-white" />
                        ) : (
                          <Wallet className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-base font-black font-mono text-slate-900 dark:text-white">
                            {shortId(loan.id)}
                          </span>
                          {loan.collateralCode && (
                            <span
                              className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md tracking-wider"
                              style={{
                                background:
                                  "linear-gradient(135deg, rgba(234,179,8,0.1), rgba(245,158,11,0.1))",
                                color: "#b45309",
                                border: "1px solid rgba(234,179,8,0.25)",
                              }}
                            >
                              ITEM: {loan.collateralCode}
                            </span>
                          )}
                          {isClosed && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 tracking-wider">
                              CLOSED
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                          {borrower?.fullName} · {m(loan.principal)} · {loan.rate}%/mo
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Timeline */}
              <div className="relative">
                {/* Vertical timeline line */}
                <div className="absolute left-[19px] sm:left-[23px] top-0 bottom-0 w-px bg-gradient-to-b from-sky-400/40 via-blue-300/20 to-transparent" />

                <div className="space-y-1">
                  {allHistory.map((h, idx) => {
                    const isLatest = latestPerLoan.get(h.loanId) === h.id;
                    const loan = loans.find((l) => l.id === h.loanId);
                    const isClosed = loan?.status === "closed";
                    return (
                      <motion.div
                        key={h.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04, duration: 0.3 }}
                        className="relative flex gap-4 sm:gap-5 group"
                      >
                        {/* Timeline dot */}
                        <div className="relative z-10 shrink-0 mt-5">
                          <div
                            className={`w-[10px] h-[10px] sm:w-[12px] sm:h-[12px] rounded-full border-2 transition-all ${idx === 0 ? "border-sky-500 bg-sky-500 shadow-[0_0_10px_rgba(56,189,248,0.4)]" : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 group-hover:border-sky-400"}`}
                          />
                        </div>

                        {/* Entry card */}
                        <div className="flex-1 pb-4">
                          <div className="rounded-xl border border-gray-200/80 dark:border-slate-700/50 bg-white dark:bg-slate-800/60 p-4 sm:p-5 hover:shadow-md dark:hover:shadow-slate-900/40 transition-all hover:border-sky-200 dark:hover:border-sky-800/40 group-hover:bg-sky-50/30 dark:group-hover:bg-sky-950/10">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                                  <CalendarDays className="w-3.5 h-3.5 text-sky-500/70" />
                                  <span>{format(new Date(h.startDate), "dd MMM yyyy")}</span>
                                  <span className="text-slate-300 dark:text-slate-600">→</span>
                                  <span>{format(new Date(h.endDate), "dd MMM yyyy")}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock className="w-3 h-3 text-slate-300 dark:text-slate-600" />
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                    Logged {new Date(h.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-slate-700/40">
                                {isLatest && !isClosed && (
                                  <button
                                    onClick={() => setDeleteTargetId(h.id)}
                                    className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-lg transition-all hover:bg-red-50 dark:hover:bg-red-950/20"
                                    title="Rollback"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <div className="font-mono">
                                  <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                                    {m(h.amount, { decimals: 2 })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          ) : (
            /* ─── Grouped Accordion View ─── */
            <motion.div
              key="grouped"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {groupedByLoan &&
                Array.from(groupedByLoan.entries()).map(([loanId, entries], groupIdx) => {
                  const loan = loans.find((l) => l.id === loanId);
                  const borrower = loan ? borrowers.find((b) => b.id === loan.borrowerId) : null;
                  const isClosed = loan?.status === "closed";
                  const loanTotal = entries.reduce((sum, e) => sum + e.amount, 0);
                  const isExpanded = expandedLoans.has(loanId);
                  return (
                    <motion.div
                      key={loanId}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: groupIdx * 0.06, duration: 0.35 }}
                      className="rounded-2xl border border-gray-200/80 dark:border-slate-700/50 bg-white dark:bg-slate-800/60 overflow-hidden transition-shadow hover:shadow-md dark:hover:shadow-slate-900/40"
                    >
                      {/* Accordion header */}
                      <button
                        type="button"
                        onClick={() => toggleLoanExpanded(loanId)}
                        className="w-full p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left cursor-pointer transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/20"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                              background: isClosed
                                ? "linear-gradient(135deg, #64748b, #94a3b8)"
                                : "linear-gradient(135deg, #2563eb, #38bdf8)",
                            }}
                          >
                            {isClosed ? (
                              <Lock className="w-5 h-5 text-white" />
                            ) : (
                              <Wallet className="w-5 h-5 text-white" />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-white">
                                {loanId}
                              </span>
                              {loan?.collateralCode && (
                                <span
                                  className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded tracking-wider"
                                  style={{
                                    background:
                                      "linear-gradient(135deg, rgba(234,179,8,0.1), rgba(245,158,11,0.1))",
                                    color: "#b45309",
                                    border: "1px solid rgba(234,179,8,0.25)",
                                  }}
                                >
                                  ITEM: {loan.collateralCode}
                                </span>
                              )}
                              {isClosed && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 tracking-wider">
                                  CLOSED
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                              {borrower?.fullName} · {m(loan?.principal ?? 0)} · {loan?.rate}%/mo
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="text-right">
                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.12em] block">
                              Collected
                            </span>
                            <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono leading-none">
                              {m(loanTotal)}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700/60 rounded-full px-2.5 py-1 tracking-wider whitespace-nowrap">
                            {entries.length}
                          </span>
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center shrink-0"
                          >
                            <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                          </motion.div>
                        </div>
                      </button>

                      {/* Collapsible timeline entries */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="border-t border-slate-100 dark:border-slate-700/40 px-5 sm:px-6 py-4 relative">
                              {/* Mini timeline line */}
                              <div className="absolute left-[35px] sm:left-[39px] top-4 bottom-4 w-px bg-gradient-to-b from-sky-300/30 to-transparent" />

                              <div className="space-y-0.5">
                                {entries.map((h, idx) => {
                                  const isLatest = latestPerLoan.get(h.loanId) === h.id;
                                  return (
                                    <div
                                      key={h.id}
                                      className="relative flex gap-3 sm:gap-4 group py-2.5 hover:bg-sky-50/30 dark:hover:bg-sky-950/10 rounded-lg px-1 transition-colors"
                                    >
                                      {/* Dot */}
                                      <div className="relative z-10 shrink-0 mt-2">
                                        <div
                                          className={`w-2 h-2 rounded-full transition-all ${idx === 0 ? "bg-sky-500 shadow-[0_0_6px_rgba(56,189,248,0.3)]" : "bg-slate-300 dark:bg-slate-600 group-hover:bg-sky-400"}`}
                                        />
                                      </div>

                                      <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
                                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                                          <span>
                                            {format(new Date(h.startDate), "dd MMM yyyy")}
                                          </span>
                                          <span className="text-slate-300 dark:text-slate-600">
                                            →
                                          </span>
                                          <span>{format(new Date(h.endDate), "dd MMM yyyy")}</span>
                                          <span className="text-[10px] text-slate-300 dark:text-slate-600 ml-1 hidden sm:inline">
                                            · {new Date(h.createdAt).toLocaleDateString()}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                          {isLatest && !isClosed && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteTargetId(h.id);
                                              }}
                                              className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-1 rounded transition-all hover:bg-red-50/80 dark:hover:bg-red-950/20"
                                              title="Rollback"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          )}
                                          <span className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
                                            {m(h.amount, { decimals: 2 })}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
            </motion.div>
          )
        ) : (
          /* ─── Empty State ─── */
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700/50 flex flex-col items-center justify-center p-12 text-center min-h-[360px]"
          >
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
              style={{
                background: "linear-gradient(135deg, rgba(100,116,139,0.1), rgba(148,163,184,0.1))",
              }}
            >
              <HistoryIcon className="w-9 h-9 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="font-semibold text-slate-500 dark:text-slate-400 text-sm mb-1">
              No Payment History
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">
              {selectedLoanId
                ? "No interest has been collected for this loan yet."
                : "No records found. Start by calculating and committing interest from the Interest page."}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════ Delete Confirmation Modal ══════ */}
      <AnimatePresence>
        {deleteTargetId && (
          <div className="fixed inset-0 z-100 flex items-end sm:items-center justify-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm"
              onClick={() => setDeleteTargetId(null)}
            />
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl safe-area-bottom flex flex-col overflow-hidden"
            >
              <div className="p-5 sm:p-6 flex-1">
                <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-5 sm:hidden" />
                <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4 border border-red-200 dark:border-red-800/40 mx-auto">
                  <AlertOctagon className="w-7 h-7 text-red-500" />
                </div>
                <h3 className="text-lg font-black text-center text-slate-900 dark:text-white tracking-tight mb-2">
                  Rollback Entry
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm text-center leading-relaxed">
                  This will reverse the ledger state and undo any principal capitalizations.
                </p>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-700/50 flex shrink-0">
                <button
                  onClick={() => setDeleteTargetId(null)}
                  className="flex-1 py-3.5 text-xs font-bold tracking-widest uppercase text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-r border-slate-100 dark:border-slate-700/50 rounded-none rounded-bl-2xl sm:rounded-bl-2xl"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    deleteInterest(deleteTargetId);
                    setDeleteTargetId(null);
                    toast.success("Ledger entry rolled back.");
                  }}
                  className="flex-1 py-3.5 text-xs font-bold tracking-widest uppercase text-white bg-red-500 hover:bg-red-600 transition-colors rounded-none rounded-br-2xl sm:rounded-br-2xl"
                >
                  Confirm Undo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
