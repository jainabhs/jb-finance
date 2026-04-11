import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  AlertOctagon,
  IndianRupee,
  HandCoins,
  History,
  UserSquare2,
  Hash,
  Trash2,
  Lock,
  Share2,
} from "lucide-react";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import { motion, AnimatePresence } from "framer-motion";
import { calculateCompoundInterest } from "../lib/interest";
import { useMockData } from "../lib/MockContext";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { Select } from "../components/ui/Select";
import { usePrivacy } from "../lib/PrivacyContext";
import { lockScroll } from "../lib/utils";
import { Download } from "lucide-react";

export default function GenerateInterest() {
  const { loans, borrowers, addInterest, interests, globalBorrowerId, deleteInterest } =
    useMockData();
  const { m } = usePrivacy();
  const [searchParams] = useSearchParams();

  const initialLoanId = searchParams.get("loanId") || "";

  const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [selectedLoanId, setSelectedLoanId] = useState<string>(initialLoanId);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [activeTab, setActiveTab] = useState<"draft" | "history">("draft");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    lockScroll(!!deleteTargetId);
    return () => lockScroll(false);
  }, [deleteTargetId]);

  // When linked directly via ?loanId=, derive the borrower from the loan
  const linkedLoan = initialLoanId ? loans.find((l) => l.id === initialLoanId) : null;
  const effectiveBorrowerId = globalBorrowerId || linkedLoan?.borrowerId || null;

  const filteredLoans = effectiveBorrowerId
    ? loans.filter((l) => l.borrowerId === effectiveBorrowerId && l.status === "active")
    : [];

  const globalBorrower = borrowers.find((b) => b.id === effectiveBorrowerId);

  const loan = filteredLoans.find((l) => l.id === selectedLoanId);
  const isClosedLoan = loan?.status === "closed";
  const borrower = loan ? borrowers.find((b) => b.id === loan.borrowerId) : null;
  const loanHistory = interests
    .filter((i) => i.loanId === selectedLoanId)
    .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
  const latestHistoryId = loanHistory.length > 0 ? loanHistory[0].id : null;

  const fullCalculation = useMemo(() => {
    if (!loan) return null;
    try {
      const end = new Date(targetDate);
      if (isNaN(end.getTime())) return null;
      const startDate = new Date(loan.lastPaymentDate);
      if (end <= startDate) return null;
      return calculateCompoundInterest(
        loan.principal,
        loan.rate,
        startDate,
        end,
        Math.max(1, loan.thresholdMonths),
      );
    } catch {
      return null;
    }
  }, [targetDate, loan]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [fullCalculation]);
  useEffect(() => {
    if (isClosedLoan) setActiveTab("history");
  }, [isClosedLoan]);

  const selectedCalculation = useMemo(() => {
    if (
      !loan ||
      !fullCalculation ||
      selectedIndex < 0 ||
      selectedIndex >= fullCalculation.periods.length
    )
      return null;
    const end = fullCalculation.periods[selectedIndex].endDate;
    const startDate = new Date(loan.lastPaymentDate);
    const result = calculateCompoundInterest(
      loan.principal,
      loan.rate,
      startDate,
      end,
      Math.max(1, loan.thresholdMonths),
    );
    return {
      ...result,
      startDate,
      endDate: end,
      isCapitalized: result.finalPrincipal > loan.principal,
    };
  }, [loan, fullCalculation, selectedIndex]);

  const currentUnpaidInterest = useMemo(() => {
    if (!loan) return 0;
    const today = new Date();
    const start = new Date(loan.lastPaymentDate);
    if (today <= start) return 0;
    return calculateCompoundInterest(
      loan.principal,
      loan.rate,
      start,
      today,
      Math.max(1, loan.thresholdMonths),
    ).totalInterest;
  }, [loan]);

  const totalCollectedInterest = useMemo(
    () => loanHistory.reduce((sum, h) => sum + h.amount, 0),
    [loanHistory],
  );

  const handleCommit = async () => {
    if (!loan || !selectedCalculation || !fullCalculation) return;
    const selectedPeriods = fullCalculation.periods.slice(0, selectedIndex + 1);
    for (let idx = 0; idx < selectedPeriods.length; idx++) {
      const p = selectedPeriods[idx];
      const isLast = idx === selectedPeriods.length - 1;
      await addInterest({
        loanId: loan.id,
        startDate: p.startDate.toISOString(),
        endDate: p.endDate.toISOString(),
        amount: p.amount,
        newPrincipal: isLast ? selectedCalculation.finalPrincipal : p.principalAtTime,
      });
    }
    toast.success(`${selectedPeriods.length} month(s) saved!`);
  };

  const receiptRef = useRef<HTMLDivElement>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const generateReceiptFile = useCallback(async (): Promise<File | null> => {
    if (!loan || !borrower || loanHistory.length === 0) return null;

    if (loanHistory.length <= 3) {
      // Image mode
      setShowReceipt(true);
      await new Promise((r) => setTimeout(r, 150));
      if (!receiptRef.current) return null;
      try {
        const canvas = await html2canvas(receiptRef.current, {
          scale: 2,
          backgroundColor: "#ffffff",
        });
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
        if (!blob) return null;
        return new File([blob], `receipt-${loan.collateralCode || "receipt"}.png`, {
          type: "image/png",
        });
      } finally {
        setShowReceipt(false);
      }
    } else {
      // PDF mode
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pw = doc.internal.pageSize.getWidth();
      const margin = 16;
      let y = 20;

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pw, 44, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("JB FINANCE", margin, y);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("INTEREST RECEIPT", margin, y + 6);
      doc.setFontSize(9);
      doc.setTextColor(56, 189, 248);
      doc.text(format(new Date(), "dd MMM yyyy, hh:mm a"), pw - margin, y, { align: "right" });

      y = 34;
      doc.setTextColor(226, 232, 240);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(borrower.fullName, margin, y);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `${loan.collateralCode || "—"}  ·  ₹${loan.principal.toLocaleString("en-IN")}  ·  ${loan.rate}%/mo`,
        margin,
        y + 5,
      );

      y = 52;
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, pw - margin * 2, 8, "F");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "bold");
      doc.text("#", margin + 3, y + 5.5);
      doc.text("PERIOD", margin + 14, y + 5.5);
      doc.text("AMOUNT", pw - margin - 3, y + 5.5, { align: "right" });
      y += 10;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      loanHistory
        .slice()
        .reverse()
        .forEach((h, idx) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          if (idx % 2 === 0) {
            doc.setFillColor(248, 250, 252);
            doc.rect(margin, y - 3, pw - margin * 2, 8, "F");
          }
          doc.setTextColor(71, 85, 105);
          doc.text(`${idx + 1}`, margin + 3, y + 2);
          doc.text(
            `${format(new Date(h.startDate), "dd MMM yy")} → ${format(new Date(h.endDate), "dd MMM yy")}`,
            margin + 14,
            y + 2,
          );
          doc.setTextColor(15, 23, 42);
          doc.setFont("helvetica", "bold");
          doc.text(`₹${h.amount.toLocaleString("en-IN")}`, pw - margin - 3, y + 2, {
            align: "right",
          });
          doc.setFont("helvetica", "normal");
          y += 8;
        });

      y += 4;
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(margin, y, pw - margin * 2, 14, 3, 3, "F");
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(7);
      doc.text("TOTAL COLLECTED", margin + 5, y + 6);
      doc.setTextColor(16, 185, 129);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`₹${totalCollectedInterest.toLocaleString("en-IN")}`, margin + 5, y + 12);
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(`${loanHistory.length} ENTRIES`, pw - margin - 5, y + 10, { align: "right" });

      const pdfBlob = doc.output("blob");
      return new File([pdfBlob], `receipt-${loan.collateralCode || "receipt"}.pdf`, {
        type: "application/pdf",
      });
    }
  }, [loan, borrower, loanHistory, totalCollectedInterest]);

  const handleShareReceipt = useCallback(async () => {
    try {
      const file = await generateReceiptFile();
      if (!file) return;
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Interest Receipt` });
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("File saved!");
      }
    } catch {
      toast.error("Could not share");
    }
  }, [generateReceiptFile]);

  const handleDownloadReceipt = useCallback(async () => {
    try {
      const file = await generateReceiptFile();
      if (!file) return;
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${file.type.includes("pdf") ? "PDF" : "Image"} downloaded!`);
    } catch {
      toast.error("Could not download");
    }
  }, [generateReceiptFile]);

  return (
    <div className="space-y-4 sm:space-y-5 overflow-hidden">
      <div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          Interest Calculator
        </h2>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          Calculate &amp; record interest collections
        </p>
      </div>

      {/* Control Bar */}
      {!effectiveBorrowerId ? (
        <div className="flex items-center gap-3 bg-sky-50 dark:bg-sky-900/15 border border-sky-200 dark:border-sky-800/40 rounded-xl px-4 py-3">
          <UserSquare2 className="w-5 h-5 text-sky-500 dark:text-sky-400 shrink-0" />
          <p className="text-sm text-sky-700 dark:text-sky-300">
            Select a borrower from the top navbar to get started.
          </p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
          <div className="flex-1">
            <Select
              value={selectedLoanId}
              onChange={(val) => setSelectedLoanId(val)}
              options={filteredLoans.map((l) => ({
                value: l.id,
                label: `${l.collateralCode || "—"} · ₹${l.principal.toLocaleString("en-IN")}`,
              }))}
              placeholder={`Loan for ${globalBorrower?.fullName.split(" ")[0] || "borrower"}...`}
              disabled={filteredLoans.length === 0}
              icon={
                <Hash
                  className={`h-4 w-4 ${filteredLoans.length === 0 ? "text-slate-300 dark:text-slate-600" : "text-sky-600 dark:text-sky-400"}`}
                />
              }
              buttonClassName={`w-full bg-white dark:bg-slate-800/80 border rounded-xl py-2.5 px-3 text-sm font-semibold focus:ring-2 transition-all ${filteredLoans.length === 0 ? "border-red-200 dark:border-red-800/40 text-slate-400 dark:text-slate-500" : "border-slate-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-600/50 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-sky-100 dark:focus:ring-sky-900/30"}`}
            />
          </div>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl py-2.5 px-3 text-sm outline-none focus:border-sky-500 dark:focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/30 transition-all sm:w-44"
          />
        </div>
      )}

      <div className="flex flex-col min-w-0">
        {loan ? (
          <motion.div
            key={targetDate}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col relative transition-colors"
          >
            {/* Tab Header */}
            <div className="relative z-10 flex items-center justify-between mb-4 gap-3">
              <div className="flex flex-col min-w-0">
                <h3 className="text-base lg:text-xl font-black tracking-tight text-slate-900 dark:text-white leading-none mb-0.5 truncate">
                  {activeTab === "history" ? "Payment History" : "Calculation"}
                </h3>
                <p className="text-[10px] lg:text-[11px] text-slate-400 dark:text-slate-500 tracking-wide truncate">
                  {activeTab === "history" ? "Past records" : "Select rows to save"}
                </p>
              </div>
              {!isClosedLoan ? (
                <div className="flex bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 shrink-0 h-9">
                  <button
                    onClick={() => setActiveTab("draft")}
                    className={`px-4 rounded-md text-[11px] font-bold tracking-wider uppercase transition-all flex items-center justify-center h-full ${activeTab === "draft" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400"}`}
                  >
                    Draft
                  </button>
                  <button
                    onClick={() => setActiveTab("history")}
                    className={`px-4 rounded-md text-[11px] font-bold tracking-wider uppercase transition-all flex items-center justify-center h-full ${activeTab === "history" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400"}`}
                  >
                    History
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5">
                  <Lock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                  <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                    Closed
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col relative z-10 w-full overflow-hidden">
              {activeTab === "draft" ? (
                <>
                  {fullCalculation && fullCalculation.periods.length > 0 ? (
                    <div className="flex flex-col relative">
                      {/* Mobile: card rows */}
                      <div className="lg:hidden space-y-2 pb-6 w-full">
                        {fullCalculation.periods.map((p, idx) => {
                          const isSelected = idx <= selectedIndex;
                          return (
                            <div
                              key={idx}
                              onClick={() => setSelectedIndex(selectedIndex === idx ? idx - 1 : idx)}
                              className={`group relative p-3 rounded-lg border transition-all duration-200 cursor-pointer
                                ${isSelected
                                  ? "bg-sky-50/80 dark:bg-sky-900/20 border-sky-300 dark:border-sky-600/40"
                                  : "bg-slate-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700/50"
                                }`}
                            >
                              <div className="flex items-center gap-2.5 w-full">
                                <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center border-2 transition-all ${isSelected ? "bg-sky-500 border-sky-400 text-white" : "bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-slate-400"}`}>
                                  <span className="font-mono text-[10px] font-black">{idx + 1}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className={`text-[11px] font-mono font-semibold truncate ${isSelected ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}>
                                    {format(p.startDate, "dd MMM")} → {format(p.endDate, "dd MMM yy")}
                                    {p.label !== "1 Month" && <span className={`ml-1.5 text-[9px] ${isSelected ? "text-sky-500" : "text-slate-400"}`}>{p.label}</span>}
                                  </div>
                                  <div className={`text-[10px] ${isSelected ? "text-violet-500 dark:text-violet-400" : "text-violet-400 dark:text-violet-500"}`}>
                                    Base {m(p.principalAtTime, { decimals: 0 })}
                                  </div>
                                </div>
                                <span className={`text-sm font-black font-mono shrink-0 ${isSelected ? "text-emerald-700 dark:text-emerald-300" : "text-emerald-600 dark:text-emerald-400"}`}>
                                  {m(p.amount, { decimals: 0 })}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop: clean table */}
                      <div className="hidden lg:block pb-6 w-full">
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
                          {/* Header */}
                          <div className="flex items-center py-2.5 px-4 bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700/50">
                            <div className="w-10 shrink-0 text-slate-400 dark:text-slate-500">#</div>
                            <div className="flex-1 text-slate-400 dark:text-slate-500">Period</div>
                            <div className="w-36 text-right shrink-0 text-slate-400 dark:text-slate-500">Base</div>
                            <div className="w-36 text-right shrink-0 text-emerald-600 dark:text-emerald-400">Interest</div>
                          </div>
                          {/* Rows */}
                          {fullCalculation.periods.map((p, idx) => {
                            const isSelected = idx <= selectedIndex;
                            const isEven = idx % 2 === 0;
                            return (
                              <div
                                key={idx}
                                onClick={() => setSelectedIndex(selectedIndex === idx ? idx - 1 : idx)}
                                className={`flex items-center py-3 px-4 cursor-pointer transition-all duration-150 border-l-[3px]
                                  ${isSelected
                                    ? "bg-sky-50 dark:bg-sky-900/15 border-l-sky-500"
                                    : `${isEven ? "bg-white dark:bg-transparent" : "bg-slate-50/50 dark:bg-slate-800/20"} border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800/30`
                                  }`}
                              >
                                <div className={`w-10 shrink-0 font-mono text-xs font-black ${isSelected ? "text-sky-600 dark:text-sky-400" : "text-slate-400 dark:text-slate-500"}`}>
                                  {idx + 1}
                                </div>
                                <div className={`flex-1 text-sm min-w-0 ${isSelected ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"}`}>
                                  <span className="font-mono">{format(p.startDate, "dd MMM yyyy")}</span>
                                  <span className={`mx-2 ${isSelected ? "text-sky-400" : "text-slate-300 dark:text-slate-600"}`}>→</span>
                                  <span className="font-mono">{format(p.endDate, "dd MMM yyyy")}</span>
                                  {p.label !== "1 Month" && (
                                    <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${isSelected ? "bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                                      {p.label}
                                    </span>
                                  )}
                                </div>
                                <div className={`w-36 text-right text-sm font-mono font-bold shrink-0 ${isSelected ? "text-violet-700 dark:text-violet-300" : "text-violet-500 dark:text-violet-400"}`}>
                                  {m(p.principalAtTime, { decimals: 0 })}
                                </div>
                                <div className={`w-36 text-right font-mono text-sm font-black shrink-0 ${isSelected ? "text-emerald-700 dark:text-emerald-300" : "text-emerald-600 dark:text-emerald-400"}`}>
                                  {m(p.amount, { decimals: 0 })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pb-64 sm:pb-36" />
                    </div>
                  ) : (
                    <div className="text-center py-20 flex-1 flex flex-col justify-center items-center px-4 bg-slate-50 dark:bg-slate-800/30 border border-dashed border-gray-200 dark:border-slate-700/40 rounded-2xl">
                      <IndianRupee className="w-16 h-16 mb-4 text-slate-300 dark:text-slate-600" />
                      <p className="font-mono text-sm tracking-widest uppercase text-slate-400 dark:text-slate-500">
                        No Unpaid Periods.
                      </p>
                      <p className="font-mono text-xs mt-2 text-slate-400 dark:text-slate-500">
                        Pick a future date to generate calculable rows.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full flex flex-col relative">
                  {loanHistory.length > 0 ? (
                    <div className="space-y-2 sm:space-y-4 pb-6 w-full">
                      {/* Loan summary card */}
                      <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950 p-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-sky-500/5 -translate-y-8 translate-x-8" />
                        <div className="relative">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="text-[9px] text-slate-400 uppercase tracking-[0.2em] font-bold mb-0.5">Principal</div>
                              <div className="text-xl font-black text-white font-mono tracking-tight leading-none">{m(loan.principal)}</div>
                              <span className="text-xs font-bold text-sky-400 font-mono bg-sky-500/10 px-2 py-0.5 rounded inline-block mt-2">{loan.rate}%/mo</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => void handleShareReceipt()}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 transition-colors"
                                title="Share"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => void handleDownloadReceipt()}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                                title="Download"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-700/50">
                            <div>
                              <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Paid till</div>
                              <div className="text-xs font-semibold text-slate-300 font-mono mt-0.5">{format(new Date(loan.lastPaymentDate), "MMM yy")}</div>
                            </div>
                            <div>
                              <div className="text-[9px] text-emerald-500 uppercase tracking-wider font-bold">Collected</div>
                              <div className="text-xs font-semibold text-emerald-300 font-mono mt-0.5">{m(totalCollectedInterest)}</div>
                            </div>
                            <div>
                              <div className="text-[9px] text-amber-500 uppercase tracking-wider font-bold">Unpaid</div>
                              <div className="text-xs font-semibold text-amber-300 font-mono mt-0.5">{m(currentUnpaidInterest)}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      {loanHistory.map((h) => (
                        <div
                          key={h.id}
                          className="p-3 sm:p-6 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-slate-700/40 bg-white dark:bg-slate-800/40 transition-all"
                        >
                          <div className="flex items-center gap-2.5 sm:gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] sm:text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 truncate">
                                {format(new Date(h.startDate), "dd MMM")} → {format(new Date(h.endDate), "dd MMM yy")}
                              </div>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                {new Date(h.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                            <span className="text-sm sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono shrink-0">
                              {m(h.amount, { decimals: 0 })}
                            </span>
                            {h.id === latestHistoryId && !isClosedLoan && (
                              <button
                                onClick={() => setDeleteTargetId(h.id)}
                                className="text-red-400 dark:text-red-500 bg-red-50 dark:bg-red-950/30 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-red-200 dark:border-red-800/40 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors shrink-0"
                                title="Undo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20 flex flex-col justify-center items-center px-4 bg-slate-50 dark:bg-slate-800/30 border border-dashed border-gray-200 dark:border-slate-700/40 rounded-2xl">
                      <History className="w-16 h-16 mb-4 text-slate-300 dark:text-slate-600" />
                      <p className="font-mono text-sm tracking-widest uppercase text-slate-400 dark:text-slate-400">
                        No Payment History.
                      </p>
                      <p className="font-mono text-xs mt-2 text-slate-400 dark:text-slate-500">
                        No interest has been collected for this loan yet.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <div className="bg-white dark:bg-slate-800/60 rounded-3xl border border-dashed border-gray-200 dark:border-slate-700/40 flex flex-col items-center justify-center p-8 text-center min-h-[400px] shadow-sm">
            <div className="w-24 h-24 rounded-full bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center justify-center mb-6">
              <IndianRupee className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="font-mono text-sm tracking-widest text-slate-400 dark:text-slate-500 uppercase">
              Select a borrower and loan to begin.
            </p>
          </div>
        )}
      </div>

      {/* Fixed Action Footer — outside motion.div to avoid transform clipping */}
      {loan && activeTab === "draft" && fullCalculation && fullCalculation.periods.length > 0 && (
        <div className="fixed bottom-24 lg:bottom-0 left-0 right-0 z-40 lg:bg-white/95 lg:dark:bg-slate-900/95 lg:backdrop-blur-xl lg:border-t lg:border-slate-200 lg:dark:border-slate-700/60 lg:shadow-[0_-4px_20px_rgba(0,0,0,0.08)] lg:dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)] lg:safe-area-bottom px-5 lg:px-0">
          <div className="max-w-7xl mx-auto lg:px-6 px-4 py-2.5 sm:py-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl lg:bg-transparent lg:dark:bg-transparent lg:backdrop-blur-none rounded-2xl lg:rounded-none border border-slate-200/80 dark:border-slate-700/60 lg:border-0 shadow-lg lg:shadow-none">
            <AnimatePresence>
              {selectedCalculation?.isCapitalized && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-lg bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 p-2.5 sm:p-4 mb-2.5 sm:mb-4 flex items-center gap-3 overflow-hidden"
                >
                  <AlertOctagon className="w-5 h-5 text-amber-500 shrink-0" />
                  <p className="text-[9px] sm:text-[10px] text-amber-600 dark:text-amber-400/70 font-mono leading-tight">
                    Calc Base:{" "}
                    <strong className="text-amber-800 dark:text-amber-300">
                      {m(selectedCalculation.finalPrincipal, { decimals: 2 })}
                    </strong>{" "}
                    (penalty after {loan.thresholdMonths}mo)
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 tracking-wide mb-0.5 flex items-center gap-2">
                  To Collect
                  {selectedIndex >= 0 && (
                    <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-mono border border-emerald-200 dark:border-emerald-700/50 text-[9px]">
                      {selectedIndex + 1}mo
                    </span>
                  )}
                </span>
                <span className="text-xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-300 font-mono tracking-tight leading-none truncate">
                  {m(selectedCalculation?.totalInterest ?? 0, { decimals: 2 })}
                </span>
              </div>
              <button
                onClick={handleCommit}
                disabled={selectedIndex < 0}
                className="tech-button-primary px-5 py-2.5 sm:px-6 sm:py-3 text-xs tracking-wide flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 outline-none"
              >
                <HandCoins className="w-4 h-4 sm:w-5 sm:h-5 -rotate-12" /> Collect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      <AnimatePresence>
        {deleteTargetId && (
          <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center lg:p-4">
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
                  This will remove the last recorded interest and restore the previous principal.
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
                  onClick={async () => {
                    await deleteInterest(deleteTargetId!);
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

      {/* Hidden receipt — movie ticket style */}
      {showReceipt && loan && borrower && (
        <div className="fixed -left-[9999px] top-0">
          <div
            ref={receiptRef}
            style={{
              width: 420,
              fontFamily: "Inter, system-ui, sans-serif",
              background: "#f1f5f9",
              padding: 20,
            }}
          >
            {/* Ticket body */}
            <div
              style={{
                background: "#0f172a",
                borderRadius: "20px 20px 0 0",
                padding: "28px 28px 20px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Decorative circles */}
              <div
                style={{
                  position: "absolute",
                  top: 20,
                  right: 20,
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: "rgba(56,189,248,0.08)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: -20,
                  left: -20,
                  width: 100,
                  height: 100,
                  borderRadius: "50%",
                  background: "rgba(99,102,241,0.06)",
                }}
              />

              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 24,
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "linear-gradient(135deg, #fbbf24, #d97706)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span style={{ color: "#fff", fontWeight: 900, fontSize: 15 }}>₹</span>
                  </div>
                  <span
                    style={{ color: "#ffffff", fontWeight: 900, fontSize: 15, letterSpacing: -0.5 }}
                  >
                    JB FINANCE
                  </span>
                </div>
                <span
                  style={{
                    color: "#38bdf8",
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: 3,
                    textTransform: "uppercase",
                    background: "rgba(56,189,248,0.1)",
                    padding: "4px 10px",
                    borderRadius: 20,
                  }}
                >
                  Receipt
                </span>
              </div>

              {/* Borrower + Loan ID hero */}
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    color: "#64748b",
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: 3,
                    marginBottom: 4,
                  }}
                >
                  Borrower
                </div>
                <div
                  style={{
                    color: "#ffffff",
                    fontSize: 22,
                    fontWeight: 900,
                    letterSpacing: -0.5,
                    lineHeight: 1.1,
                  }}
                >
                  {borrower.fullName}
                </div>
              </div>

              {/* Info grid */}
              <div style={{ display: "flex", gap: 12 }}>
                {[
                  { label: "Collateral", value: loan.collateralCode || "—", mono: true },
                  {
                    label: "Principal",
                    value: `₹${loan.principal.toLocaleString("en-IN")}`,
                    mono: true,
                  },
                  { label: "Rate", value: `${loan.rate}%/mo`, mono: false },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      flex: 1,
                      background: "rgba(255,255,255,0.05)",
                      borderRadius: 10,
                      padding: "10px 12px",
                    }}
                  >
                    <div
                      style={{
                        color: "#64748b",
                        fontSize: 8,
                        textTransform: "uppercase",
                        letterSpacing: 2,
                        marginBottom: 3,
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{
                        color: "#e2e8f0",
                        fontSize: 12,
                        fontWeight: 800,
                        fontFamily: item.mono ? "monospace" : "inherit",
                      }}
                    >
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tear line with cutouts */}
            <div style={{ position: "relative", height: 24, background: "#f1f5f9" }}>
              {/* Left cutout */}
              <div
                style={{
                  position: "absolute",
                  left: -12,
                  top: -12,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "#f1f5f9",
                }}
              />
              {/* Right cutout */}
              <div
                style={{
                  position: "absolute",
                  right: -12,
                  top: -12,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "#f1f5f9",
                }}
              />
              {/* Dashed line */}
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: 20,
                  right: 20,
                  borderTop: "2px dashed #cbd5e1",
                }}
              />
            </div>

            {/* Stub - payment details */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "0 0 20px 20px",
                padding: "16px 28px 24px",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: 3,
                  marginBottom: 12,
                  fontWeight: 700,
                }}
              >
                Interest Payments
              </div>

              {loanHistory.slice(0, 10).map((h, idx) => (
                <div
                  key={h.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom:
                      idx < Math.min(loanHistory.length, 10) - 1 ? "1px solid #f1f5f9" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: idx === 0 ? "#0ea5e9" : "#e2e8f0",
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
                      {format(new Date(h.startDate), "MMM yy")} →{" "}
                      {format(new Date(h.endDate), "MMM yy")}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#0f172a",
                      fontFamily: "monospace",
                    }}
                  >
                    ₹{h.amount.toLocaleString("en-IN")}
                  </span>
                </div>
              ))}

              {/* Total bar */}
              <div
                style={{
                  marginTop: 16,
                  background: "linear-gradient(135deg, #0f172a, #1e293b)",
                  borderRadius: 12,
                  padding: "14px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 8,
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: 3,
                      marginBottom: 2,
                    }}
                  >
                    Total Collected
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 900,
                      color: "#38bdf8",
                      fontFamily: "monospace",
                      letterSpacing: -1,
                    }}
                  >
                    ₹{totalCollectedInterest.toLocaleString("en-IN")}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 8,
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: 3,
                      marginBottom: 2,
                    }}
                  >
                    Entries
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#ffffff" }}>
                    {loanHistory.length}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div
                style={{
                  textAlign: "center",
                  marginTop: 16,
                  paddingTop: 12,
                  borderTop: "1px solid #f1f5f9",
                }}
              >
                <div
                  style={{
                    fontSize: 8,
                    color: "#cbd5e1",
                    letterSpacing: 2,
                    textTransform: "uppercase",
                  }}
                >
                  {format(new Date(), "dd MMM yyyy • hh:mm a")}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
