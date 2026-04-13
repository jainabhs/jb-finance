import { useState, useMemo, useEffect } from "react";
import {
  History as HistoryIcon,
  Search,
  Wallet,
  Hash,
  Trash2,
  AlertOctagon,
  Lock,
  ChevronDown,
  Download,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { calculateCompoundInterest } from "../lib/interest";
import { useMockData } from "../lib/MockContext";
import { useSearchParams } from "react-router-dom";
import { format, addDays, differenceInDays, differenceInMonths } from "date-fns";
import { Select } from "../components/ui/Select";
import toast from "react-hot-toast";
import { usePrivacy } from "../lib/PrivacyContext";
import { lockScroll } from "../lib/utils";

export default function History() {
  const { loans, borrowers, interests, globalBorrowerId, deleteInterest } = useMockData();
  const { m } = usePrivacy();

  // Lookup maps for O(1) access
  const borrowerMap = useMemo(() => {
    const map = new Map<string, (typeof borrowers)[0]>();
    for (const b of borrowers) map.set(b.id, b);
    return map;
  }, [borrowers]);
  const loanMap = useMemo(() => {
    const map = new Map<string, (typeof loans)[0]>();
    for (const l of loans) map.set(l.id, l);
    return map;
  }, [loans]);
  const [searchParams, setSearchParams] = useSearchParams();

  const initialLoanId = searchParams.get("loanId") || "";
  const [selectedLoanId, setSelectedLoanId] = useState<string>(initialLoanId);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [mobileSheetLoanId, setMobileSheetLoanId] = useState<string | null>(null);

  useEffect(() => {
    lockScroll(!!deleteTargetId || !!mobileSheetLoanId);
    return () => lockScroll(false);
  }, [deleteTargetId, mobileSheetLoanId]);
  const [expandedLoans, setExpandedLoans] = useState<Set<string>>(new Set());

  // When linked directly via ?loanId=, derive the borrower from the loan
  const linkedLoan = initialLoanId ? (loanMap.get(initialLoanId) ?? null) : null;
  const effectiveBorrowerId = globalBorrowerId || linkedLoan?.borrowerId || null;

  const toggleLoanExpanded = (loanId: string) => {
    setExpandedLoans((prev) => {
      const next = new Set(prev);
      if (next.has(loanId)) next.delete(loanId);
      else next.add(loanId);
      return next;
    });
  };

  const globalBorrower = effectiveBorrowerId ? borrowerMap.get(effectiveBorrowerId) : undefined;

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
        const loan = loanMap.get(i.loanId);
        const borrower = loan ? borrowerMap.get(loan.borrowerId) : undefined;
        return (
          i.loanId.toLowerCase().includes(q) ||
          borrower?.fullName.toLowerCase().includes(q) ||
          loan?.collateralCode?.toLowerCase().includes(q)
        );
      });
    }
    return filtered.sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
  }, [interests, contextLoans, selectedLoanId, searchQuery, loanMap, borrowerMap]);

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
    const rows = [["Collateral ID", "Borrower", "Period Start", "Period End", "Amount", "Logged"]];
    for (const h of allHistory) {
      const loan = loanMap.get(h.loanId);
      const borrower = loan ? borrowerMap.get(loan.borrowerId) : undefined;
      rows.push([
        loan?.collateralCode || "—",
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
    a.download = `payment-history-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported!");
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Payment History
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
            className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold tracking-wide text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-sky-300 dark:hover:border-sky-600/50 hover:text-sky-600 dark:hover:text-sky-400 transition-all"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        )}
      </div>

      {/* ══════ Stats + Filters ══════ */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 dark:text-slate-500">
        <span>
          Collected{" "}
          <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
            {m(totalCollected)}
          </span>
        </span>
        <span>
          <span className="font-mono font-semibold text-sky-600 dark:text-sky-400">
            {allHistory.length}
          </span>{" "}
          records
        </span>
        <span>
          <span className="font-mono font-semibold text-violet-600 dark:text-violet-400">
            {uniqueLoanCount}
          </span>{" "}
          loans
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
        <div className="flex-1">
          <Select
            value={selectedLoanId}
            onChange={handleLoanFilterChange}
            options={[
              { value: "", label: "All Loans" },
              ...contextLoans.map((l) => {
                const b = borrowerMap.get(l.borrowerId);
                return {
                  value: l.id,
                  label: `${l.collateralCode || "—"} · ${b?.fullName || "Unknown"} · ₹${l.principal.toLocaleString("en-IN")}${l.status === "closed" ? " (Closed)" : ""}`,
                };
              }),
            ]}
            placeholder="Filter by loan..."
            icon={<Hash className="h-4 w-4 text-slate-400 dark:text-slate-500" />}
            buttonClassName="w-full bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl py-2.5 pl-4 pr-5 text-sm font-medium focus:ring-2 transition-all font-mono hover:border-sky-300 dark:hover:border-sky-600/50 focus:border-sky-500 focus:ring-sky-100 dark:focus:ring-sky-900/30"
          />
        </div>
        <div className="flex-1 relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 z-10">
            <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="block w-full bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/30 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
              {/* Loan context */}
              {(() => {
                const loan = loanMap.get(selectedLoanId);
                const borrower = loan ? borrowerMap.get(loan.borrowerId) : undefined;
                const isClosed = loan?.status === "closed";
                return loan ? (
                  <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 dark:text-slate-500">
                    <span className="text-sm font-black font-mono text-slate-900 dark:text-white">
                      {loan.collateralCode || "—"}
                    </span>
                    {isClosed && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                        CLOSED
                      </span>
                    )}
                    <span>{borrower?.fullName}</span>
                    <span className="font-mono font-semibold text-slate-600 dark:text-slate-300">
                      {m(loan.principal)}
                    </span>
                    <span className="font-semibold text-sky-600 dark:text-sky-400">
                      {loan.rate}%/mo
                    </span>
                  </div>
                ) : null;
              })()}

              {/* Timeline */}
              <div className="relative">
                <div className="absolute left-[7px] sm:left-[9px] top-2 bottom-2 w-px bg-gradient-to-b from-sky-400/40 via-blue-300/20 to-transparent" />

                <div className="space-y-0.5">
                  {allHistory.map((h, idx) => {
                    const isLatest = latestPerLoan.get(h.loanId) === h.id;
                    const loan = loanMap.get(h.loanId);
                    const isClosed = loan?.status === "closed";
                    return (
                      <motion.div
                        key={h.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(idx * 0.03, 0.5), duration: 0.25 }}
                        className="relative flex gap-3 sm:gap-4 group py-2 sm:py-2.5 hover:bg-sky-50/30 dark:hover:bg-sky-950/10 rounded-lg px-1 transition-colors"
                      >
                        <div className="relative z-10 shrink-0 mt-1.5 sm:mt-2">
                          <div
                            className={`w-[8px] h-[8px] sm:w-[10px] sm:h-[10px] rounded-full transition-all ${idx === 0 ? "bg-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.4)]" : "bg-slate-300 dark:bg-slate-600 group-hover:bg-sky-400"}`}
                          />
                        </div>

                        <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                          <div className="min-w-0">
                            <div className="text-[11px] sm:text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 truncate">
                              {format(addDays(new Date(h.startDate), 1), "dd MMM")} →{" "}
                              {format(new Date(h.endDate), "dd MMM yy")}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500">
                              {(() => {
                                const d = differenceInDays(
                                  new Date(h.endDate),
                                  new Date(h.startDate),
                                );
                                const isPartial =
                                  differenceInMonths(new Date(h.endDate), new Date(h.startDate)) <
                                  1;
                                const perDay = isPartial ? h.amount / d : h.amount / 30;
                                return (
                                  <>
                                    {isPartial && <>{d}d · </>}
                                    {m(perDay)}/day · {new Date(h.createdAt).toLocaleDateString()}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isLatest && !isClosed && (
                              <button
                                onClick={() => setDeleteTargetId(h.id)}
                                className="text-red-400 dark:text-red-500 p-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                title="Undo"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                            <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                              {m(h.amount, { decimals: 0 })}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          ) : (
            /* ─── Grouped View ─── */
            <motion.div
              key="grouped"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2 sm:space-y-3"
            >
              {groupedByLoan &&
                Array.from(groupedByLoan.entries()).map(([loanId, entries], groupIdx) => {
                  const loan = loanMap.get(loanId);
                  const borrower = loan ? borrowerMap.get(loan.borrowerId) : undefined;
                  const isClosed = loan?.status === "closed";
                  const loanTotal = entries.reduce((sum, e) => sum + e.amount, 0);
                  const isExpanded = expandedLoans.has(loanId);
                  return (
                    <motion.div
                      key={loanId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(groupIdx * 0.04, 0.5), duration: 0.25 }}
                      className="rounded-xl border border-gray-200/80 dark:border-slate-700/50 bg-white dark:bg-slate-800/60 overflow-hidden"
                    >
                      {/* Row — mobile opens sheet, desktop toggles accordion */}
                      <button
                        type="button"
                        onClick={() => {
                          if (window.innerWidth < 640) {
                            setMobileSheetLoanId(loanId);
                          } else {
                            toggleLoanExpanded(loanId);
                          }
                        }}
                        className="w-full px-3.5 py-3 sm:p-5 flex items-center justify-between gap-3 text-left cursor-pointer transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/20"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${isClosed ? "bg-slate-100 dark:bg-slate-700" : "bg-gradient-to-br from-sky-400 to-blue-600"}`}
                          >
                            {isClosed ? (
                              <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                            ) : (
                              <Wallet className="w-3.5 h-3.5 text-white" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-white">
                                {loan?.collateralCode || "—"}
                              </span>
                              <span className="text-[10px] font-bold font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700/60 rounded-full px-2 py-0.5">
                                {entries.length}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                              {isExpanded ? (
                                (() => {
                                  const unpaid =
                                    loan && loan.status === "active"
                                      ? (() => {
                                          const start = new Date(loan.lastPaymentDate);
                                          const now = new Date();
                                          if (now <= start) return 0;
                                          return calculateCompoundInterest(
                                            loan.principal,
                                            loan.rate,
                                            start,
                                            now,
                                            Math.max(1, loan.thresholdMonths),
                                            !interests.some((i) => i.loanId === loan.id),
                                          ).totalInterest;
                                        })()
                                      : 0;
                                  const totalYield = loanTotal + unpaid;
                                  const yieldPct =
                                    (loan?.principal ?? 0) > 0
                                      ? (totalYield / (loan?.principal ?? 1)) * 100
                                      : 0;
                                  return (
                                    <>
                                      {borrower?.fullName} ·{" "}
                                      <span className="font-mono font-semibold text-slate-600 dark:text-slate-300">
                                        {m(loan?.principal ?? 0)}
                                      </span>{" "}
                                      ·{" "}
                                      <span className="text-sky-600 dark:text-sky-400">
                                        {loan?.rate}%/mo
                                      </span>{" "}
                                      · Collected{" "}
                                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                        {m(loanTotal)}
                                      </span>
                                      {unpaid > 0 && (
                                        <>
                                          {" "}
                                          · Unpaid{" "}
                                          <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                                            {m(unpaid, { decimals: 0 })}
                                          </span>
                                        </>
                                      )}{" "}
                                      · Yield{" "}
                                      <span className="font-mono font-semibold text-violet-600 dark:text-violet-400">
                                        {yieldPct.toFixed(1)}%
                                      </span>
                                    </>
                                  );
                                })()
                              ) : (
                                <>
                                  {borrower?.fullName} · {m(loan?.principal ?? 0)} · {loan?.rate}
                                  %/mo
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                            {m(loanTotal)}
                          </span>
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="hidden sm:block"
                          >
                            <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                          </motion.div>
                        </div>
                      </button>

                      {/* Desktop: collapsible entries */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="overflow-hidden hidden sm:block"
                          >
                            <div className="bg-slate-50/80 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-700/40">
                              <div className="px-5 pb-3 relative max-h-64 overflow-y-auto">
                                <div className="absolute left-[28px] top-0 bottom-3 w-px bg-gradient-to-b from-sky-300/30 to-transparent" />
                                <div className="space-y-0.5">
                                  {entries.map((h, idx) => {
                                    const isLatest = latestPerLoan.get(h.loanId) === h.id;
                                    return (
                                      <div
                                        key={h.id}
                                        className="relative flex gap-3 group py-2 hover:bg-sky-50/30 dark:hover:bg-sky-950/10 rounded-lg px-1 transition-colors"
                                      >
                                        <div className="relative z-10 shrink-0 mt-1.5">
                                          <div
                                            className={`w-2 h-2 rounded-full transition-all ${idx === 0 ? "bg-sky-500 shadow-[0_0_6px_rgba(56,189,248,0.3)]" : "bg-slate-300 dark:bg-slate-600 group-hover:bg-sky-400"}`}
                                          />
                                        </div>
                                        <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                                          <div className="min-w-0">
                                            <div className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 truncate">
                                              {format(addDays(new Date(h.startDate), 1), "dd MMM")}{" "}
                                              → {format(new Date(h.endDate), "dd MMM yy")}
                                            </div>
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                              {(() => {
                                                const d = differenceInDays(
                                                  new Date(h.endDate),
                                                  new Date(h.startDate),
                                                );
                                                const isPartial =
                                                  differenceInMonths(
                                                    new Date(h.endDate),
                                                    new Date(h.startDate),
                                                  ) < 1;
                                                const perDay = isPartial
                                                  ? h.amount / d
                                                  : h.amount / 30;
                                                return (
                                                  <>
                                                    {isPartial && <>{d}d · </>}
                                                    {m(perDay)}/day ·{" "}
                                                    {new Date(h.createdAt).toLocaleDateString()}
                                                  </>
                                                );
                                              })()}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0">
                                            {isLatest && !isClosed && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setDeleteTargetId(h.id);
                                                }}
                                                className="text-red-400 dark:text-red-500 p-1 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                                title="Undo"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            )}
                                            <span className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
                                              {m(h.amount, { decimals: 0 })}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
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
            className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/50 flex flex-col items-center justify-center p-8 sm:p-12 text-center min-h-[200px] sm:min-h-[300px]"
          >
            <HistoryIcon className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="font-semibold text-slate-500 dark:text-slate-400 text-sm mb-1">
              No Payment History
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">
              {selectedLoanId
                ? "No interest has been collected for this loan yet."
                : "No records found. Calculate and save interest from the Interest page."}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════ Mobile Bottom Sheet for Grouped View ══════ */}
      <AnimatePresence>
        {mobileSheetLoanId &&
          (() => {
            const sheetLoan = loanMap.get(mobileSheetLoanId);
            const sheetBorrower = sheetLoan ? borrowerMap.get(sheetLoan.borrowerId) : undefined;
            const sheetIsClosed = sheetLoan?.status === "closed";
            const sheetEntries = interests
              .filter((i) => i.loanId === mobileSheetLoanId)
              .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
            const sheetTotal = sheetEntries.reduce((s, e) => s + e.amount, 0);
            if (!sheetLoan) return null;
            return (
              <div className="fixed inset-0 z-[100] flex flex-col justify-end lg:hidden">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
                  onClick={() => setMobileSheetLoanId(null)}
                />
                <motion.div
                  initial={{ y: "100%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "100%", opacity: 0 }}
                  transition={{ type: "spring", damping: 28, stiffness: 220 }}
                  className="relative w-full bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 rounded-t-2xl shadow-2xl safe-area-bottom max-h-[85vh] flex flex-col overflow-hidden"
                >
                  <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600 mx-auto mt-2.5 mb-1 shrink-0" />

                  {/* Stats card — sticky */}
                  <div className="px-4 pt-1 pb-2 shrink-0">
                    <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950 p-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-sky-500/5 -translate-y-8 translate-x-8" />
                      <div className="relative">
                        <div className="flex items-start justify-between mb-2.5">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-base font-black font-mono text-white">
                                {sheetLoan.collateralCode || "—"}
                              </span>
                              {sheetIsClosed && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                                  CLOSED
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400">{sheetBorrower?.fullName}</p>
                          </div>
                          <span className="text-xs font-bold text-sky-400 font-mono bg-sky-500/10 px-2 py-0.5 rounded">
                            {sheetLoan.rate}%/mo
                          </span>
                        </div>
                        {(() => {
                          const sheetUnpaid =
                            sheetLoan.status === "active"
                              ? (() => {
                                  const start = new Date(sheetLoan.lastPaymentDate);
                                  const now = new Date();
                                  if (now <= start) return 0;
                                  return calculateCompoundInterest(
                                    sheetLoan.principal,
                                    sheetLoan.rate,
                                    start,
                                    now,
                                    Math.max(1, sheetLoan.thresholdMonths),
                                    !interests.some((i) => i.loanId === sheetLoan.id),
                                  ).totalInterest;
                                })()
                              : 0;
                          const sheetYieldTotal = sheetTotal + sheetUnpaid;
                          const sheetYieldPct =
                            sheetLoan.principal > 0
                              ? (sheetYieldTotal / sheetLoan.principal) * 100
                              : 0;
                          return (
                            <div className="grid grid-cols-4 gap-2 pt-2.5 border-t border-slate-700/50">
                              <div>
                                <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">
                                  Principal
                                </div>
                                <div className="text-xs font-semibold text-white font-mono mt-0.5">
                                  {m(sheetLoan.principal)}
                                </div>
                              </div>
                              <div>
                                <div className="text-[9px] text-emerald-500 uppercase tracking-wider font-bold">
                                  Collected
                                </div>
                                <div className="text-xs font-semibold text-emerald-300 font-mono mt-0.5">
                                  {m(sheetTotal)}
                                </div>
                              </div>
                              <div>
                                <div className="text-[9px] text-amber-500 uppercase tracking-wider font-bold">
                                  Unpaid
                                </div>
                                <div className="text-xs font-semibold text-amber-300 font-mono mt-0.5">
                                  {m(sheetUnpaid, { decimals: 0 })}
                                </div>
                              </div>
                              <div>
                                <div className="text-[9px] text-violet-500 uppercase tracking-wider font-bold">
                                  Yield
                                </div>
                                <div className="text-xs font-semibold text-violet-300 font-mono mt-0.5">
                                  {sheetYieldPct.toFixed(1)}%
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-y-auto flex-1 px-4 pb-4">
                    {/* Timeline entries */}
                    <div className="relative">
                      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-sky-400/40 via-blue-300/20 to-transparent" />
                      <div className="space-y-0.5">
                        {sheetEntries.map((h, idx) => {
                          const isLatest = latestPerLoan.get(h.loanId) === h.id;
                          return (
                            <div
                              key={h.id}
                              className="relative flex gap-3 group py-2 rounded-lg px-1"
                            >
                              <div className="relative z-10 shrink-0 mt-1.5">
                                <div
                                  className={`w-[8px] h-[8px] rounded-full ${idx === 0 ? "bg-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.4)]" : "bg-slate-300 dark:bg-slate-600"}`}
                                />
                              </div>
                              <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                                <div className="min-w-0">
                                  <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300 truncate">
                                    {format(addDays(new Date(h.startDate), 1), "dd MMM")} →{" "}
                                    {format(new Date(h.endDate), "dd MMM yy")}
                                  </div>
                                  <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                    {(() => {
                                      const d = differenceInDays(
                                        new Date(h.endDate),
                                        new Date(h.startDate),
                                      );
                                      const isPartial =
                                        differenceInMonths(
                                          new Date(h.endDate),
                                          new Date(h.startDate),
                                        ) < 1;
                                      const perDay = isPartial ? h.amount / d : h.amount / 30;
                                      return (
                                        <>
                                          {isPartial && <>{d}d · </>}
                                          {m(perDay)}/day ·{" "}
                                          {new Date(h.createdAt).toLocaleDateString()}
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {isLatest && !sheetIsClosed && (
                                    <button
                                      onClick={() => {
                                        setMobileSheetLoanId(null);
                                        setDeleteTargetId(h.id);
                                      }}
                                      className="text-red-400 dark:text-red-500 p-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40"
                                      title="Undo"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                    {m(h.amount, { decimals: 0 })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="border-t border-slate-100 dark:border-slate-700/50 flex shrink-0">
                    <button
                      onClick={() => setMobileSheetLoanId(null)}
                      className="flex-1 py-3.5 text-xs font-bold tracking-widest uppercase text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              </div>
            );
          })()}
      </AnimatePresence>

      {/* ══════ Delete Confirmation Modal ══════ */}
      <AnimatePresence>
        {deleteTargetId && (
          <div className="fixed inset-0 z-100 flex items-end lg:items-center justify-center lg:p-4">
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
              className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-t-2xl lg:rounded-2xl w-full lg:max-w-md shadow-2xl safe-area-bottom flex flex-col overflow-hidden"
            >
              <div className="lg:hidden w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600 mx-auto mt-2.5 mb-1 shrink-0" />
              <div className="p-5 sm:p-6 flex-1">
                <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4 border border-red-200 dark:border-red-800/40 mx-auto">
                  <AlertOctagon className="w-7 h-7 text-red-500" />
                </div>
                <h3 className="text-lg font-black text-center text-slate-900 dark:text-white tracking-tight mb-2">
                  Undo Last Entry
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm text-center leading-relaxed">
                  This will remove this record and restore the previous principal.
                </p>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-700/50 flex shrink-0">
                <button
                  onClick={() => setDeleteTargetId(null)}
                  className="flex-1 py-3.5 text-xs font-bold tracking-widest uppercase text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-r border-slate-100 dark:border-slate-700/50 rounded-none lg:rounded-bl-2xl"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    deleteInterest(deleteTargetId);
                    setDeleteTargetId(null);
                    toast.success("Entry removed successfully.");
                  }}
                  className="flex-1 py-3.5 text-xs font-bold tracking-widest uppercase text-white bg-red-500 hover:bg-red-600 transition-colors rounded-none lg:rounded-br-2xl"
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
