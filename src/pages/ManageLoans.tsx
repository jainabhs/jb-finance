import React, { useState, useMemo, useRef, useCallback } from "react";
import {
  Search,
  Plus,
  ShieldCheck,
  Diamond,
  Home,
  Car,
  AlertOctagon,
  Terminal,
  UserSquare2,
  XCircle,
  Calendar,
  FileText,
  Lock,
  Share2,
  Download,
  Ticket,
  Trash2,
} from "lucide-react";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import { motion, AnimatePresence } from "framer-motion";
import { useMockData, type Loan } from "../lib/MockContext";
import { calculateCompoundInterest } from "../lib/interest";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Select } from "../components/ui/Select";
import { format, differenceInMonths } from "date-fns";

import { usePrivacy } from "../lib/PrivacyContext";

export default function ManageLoans() {
  const { loans, borrowers, addLoan, globalBorrowerId, interests, closeLoan, deleteLoan } =
    useMockData();
  const { m } = usePrivacy();

  // Format number with Indian commas as you type
  const fmtNum = (n: number) => (n ? n.toLocaleString("en-IN") : "");
  const parseNum = (s: string) => Number(s.replace(/,/g, "")) || 0;

  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"active" | "closed">("active");
  const [newL, setNewL] = useState({
    borrowerId: "",
    principal: 0,
    rate: 2,
    startDate: new Date().toISOString().split("T")[0],
    collateralType: "Gold",
    collateralCode: "",
    thresholdMonths: 12,
  });

  const [closureTarget, setClosureTarget] = useState<Loan | null>(null);
  const [closureDate, setClosureDate] = useState(new Date().toISOString().split("T")[0]);
  const [closureNote, setClosureNote] = useState("");

  // Share pending interest as image
  const [shareTarget, setShareTarget] = useState<Loan | null>(null);
  const pendingCardRef = useRef<HTMLDivElement>(null);

  const generatePendingFile = useCallback(
    async (loan: Loan): Promise<File | null> => {
      const b = borrowers.find((x) => x.id === loan.borrowerId);
      const calc = calculateCompoundInterest(
        loan.principal,
        loan.rate,
        new Date(loan.lastPaymentDate),
        new Date(),
        Math.max(1, loan.thresholdMonths),
      );
      if (calc.periods.length === 0) return null;
      const totalEarned = interests
        .filter((i) => i.loanId === loan.id)
        .reduce((s, i) => s + i.amount, 0);

      if (calc.periods.length <= 3) {
        // Image mode
        setShareTarget(loan);
        await new Promise((r) => setTimeout(r, 150));
        if (!pendingCardRef.current) return null;
        try {
          const canvas = await html2canvas(pendingCardRef.current, {
            scale: 2,
            backgroundColor: null,
          });
          const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
          if (!blob) return null;
          return new File([blob], `pending-${loan.collateralCode || "statement"}.png`, {
            type: "image/png",
          });
        } finally {
          setShareTarget(null);
        }
      } else {
        // PDF mode for >3 rows
        const doc = new jsPDF({ unit: "mm", format: "a4" });
        const pw = doc.internal.pageSize.getWidth();
        const margin = 16;
        let y = 20;

        // Header
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pw, 44, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("JB FINANCE", margin, y);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text("PENDING INTEREST STATEMENT", margin, y + 6);

        doc.setFontSize(9);
        doc.setTextColor(56, 189, 248);
        doc.text(format(new Date(), "dd MMM yyyy, hh:mm a"), pw - margin, y, { align: "right" });

        y = 34;
        doc.setTextColor(226, 232, 240);
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text(b?.fullName || "Unknown", margin, y);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `${loan.collateralCode || "—"}  ·  ₹${loan.principal.toLocaleString("en-IN")}  ·  ${loan.rate}%/mo`,
          margin,
          y + 5,
        );

        y = 52;

        // Table header
        doc.setFillColor(241, 245, 249);
        doc.rect(margin, y, pw - margin * 2, 8, "F");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "bold");
        doc.text("#", margin + 3, y + 5.5);
        doc.text("PERIOD", margin + 14, y + 5.5);
        doc.text("CALC BASE", margin + 80, y + 5.5);
        doc.text("INTEREST", pw - margin - 3, y + 5.5, { align: "right" });
        y += 10;

        // Rows
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        calc.periods.forEach((p, idx) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          const isEven = idx % 2 === 0;
          if (isEven) {
            doc.setFillColor(248, 250, 252);
            doc.rect(margin, y - 3, pw - margin * 2, 8, "F");
          }
          doc.setTextColor(71, 85, 105);
          doc.text(`${idx + 1}`, margin + 3, y + 2);
          doc.text(
            `${format(p.startDate, "dd MMM yy")} → ${format(p.endDate, "dd MMM yy")}   ${p.label}`,
            margin + 14,
            y + 2,
          );
          doc.text(
            `₹${p.principalAtTime.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
            margin + 80,
            y + 2,
          );
          doc.setTextColor(15, 23, 42);
          doc.setFont("helvetica", "bold");
          doc.text(
            `₹${p.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
            pw - margin - 3,
            y + 2,
            { align: "right" },
          );
          doc.setFont("helvetica", "normal");
          y += 8;
        });

        // Total bar
        y += 4;
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(margin, y, pw - margin * 2, 14, 3, 3, "F");
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7);
        doc.text("TOTAL PENDING", margin + 5, y + 6);
        doc.setTextColor(245, 158, 11);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`₹${Math.round(calc.totalInterest).toLocaleString("en-IN")}`, margin + 5, y + 12);

        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text("TOTAL EARNED", pw - margin - 5, y + 6, { align: "right" });
        doc.setTextColor(16, 185, 129);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`₹${totalEarned.toLocaleString("en-IN")}`, pw - margin - 5, y + 12, {
          align: "right",
        });

        // Return as file
        const pdfBlob = doc.output("blob");
        return new File([pdfBlob], `pending-${loan.collateralCode || "statement"}.pdf`, {
          type: "application/pdf",
        });
      }
    },
    [borrowers, interests],
  );

  const handleSharePending = useCallback(
    async (loan: Loan) => {
      try {
        const file = await generatePendingFile(loan);
        if (!file) return;
        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `Pending Interest - ${loan.id}` });
        } else {
          // Fallback to download
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
    },
    [generatePendingFile],
  );

  const handleDownloadPending = useCallback(
    async (loan: Loan) => {
      try {
        const file = await generatePendingFile(loan);
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
    },
    [generatePendingFile],
  );

  // Loan creation ticket
  const [loanTicketTarget, setLoanTicketTarget] = useState<Loan | null>(null);
  const loanTicketRef = useRef<HTMLDivElement>(null);

  const handleLoanTicket = useCallback(
    async (loan: Loan) => {
      setLoanTicketTarget(loan);
      await new Promise((r) => setTimeout(r, 150));
      if (!loanTicketRef.current) return;
      try {
        const canvas = await html2canvas(loanTicketRef.current, {
          scale: 2,
          backgroundColor: null,
        });
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
        if (!blob) return;
        const file = new File([blob], `loan-${loan.collateralCode || "ticket"}.png`, {
          type: "image/png",
        });
        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `Loan - ${loan.id}` });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = file.name;
          a.click();
          URL.revokeObjectURL(url);
          toast.success("Loan ticket saved!");
        }
      } catch {
        toast.error("Could not generate ticket");
      } finally {
        setLoanTicketTarget(null);
      }
    },
    [borrowers],
  );

  const [quickView, setQuickView] = useState<Loan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Loan | null>(null);

  const handleOpenModal = () => {
    setNewL((prev) => ({ ...prev, borrowerId: globalBorrowerId || "" }));
    setShowModal(true);
  };
  const typePrefix: Record<string, string> = {
    Gold: "GLD",
    Property: "PRP",
    Vehicle: "VEH",
    Other: "OTH",
  };

  const generateCollateralCode = (type: string, input: string) => {
    const prefix = `JB-${typePrefix[type] || "OTH"}-${input}`;
    const existing = loans.filter((l) => l.collateralCode.startsWith(prefix));
    const nextNum = existing.length + 1;
    return `${prefix}-${nextNum}`;
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newL.borrowerId && newL.principal > 0) {
      const fullCode = generateCollateralCode(newL.collateralType, newL.collateralCode);
      addLoan({ ...newL, collateralCode: fullCode });
      setShowModal(false);
      setNewL({
        borrowerId: "",
        principal: 0,
        rate: 2,
        startDate: new Date().toISOString().split("T")[0],
        collateralType: "Gold",
        collateralCode: "",
        thresholdMonths: 12,
      });
      toast.success("Loan created!");
    }
  };

  const filtered = loans.filter((l) => {
    if (l.status !== statusFilter) return false;
    if (globalBorrowerId && l.borrowerId !== globalBorrowerId) return false;
    const b = borrowers.find((x) => x.id === l.borrowerId);
    return `${l.id} ${l.collateralCode} ${b?.fullName || ""}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
  });

  const activeCount = loans.filter(
    (l) => (!globalBorrowerId || l.borrowerId === globalBorrowerId) && l.status === "active",
  ).length;
  const closedCount = loans.filter(
    (l) => (!globalBorrowerId || l.borrowerId === globalBorrowerId) && l.status === "closed",
  ).length;

  const closureCalc = useMemo(() => {
    if (!closureTarget) return null;
    const closeDateObj = new Date(closureDate);
    const lastPayment = new Date(closureTarget.lastPaymentDate);
    if (isNaN(closeDateObj.getTime()) || closeDateObj <= lastPayment) {
      return {
        unpaidInterest: 0,
        totalCollected: 0,
        settlement: closureTarget.principal,
        valid: false,
      };
    }
    const { totalInterest } = calculateCompoundInterest(
      closureTarget.principal,
      closureTarget.rate,
      lastPayment,
      closeDateObj,
      Math.max(1, closureTarget.thresholdMonths),
    );
    const totalCollected = interests
      .filter((i) => i.loanId === closureTarget.id)
      .reduce((sum, h) => sum + h.amount, 0);
    return {
      unpaidInterest: totalInterest,
      totalCollected,
      settlement: closureTarget.principal + totalInterest,
      valid: true,
    };
  }, [closureTarget, closureDate, interests]);

  const handleCloseLoan = () => {
    if (!closureTarget) return;
    closeLoan(closureTarget.id, closureDate, closureNote || undefined);
    toast.success(`Loan ${closureTarget.id} closed successfully.`);
    setClosureTarget(null);
    setClosureDate(new Date().toISOString().split("T")[0]);
    setClosureNote("");
  };

  const openClosureModal = (loan: Loan) => {
    setClosureTarget(loan);
    setClosureDate(new Date().toISOString().split("T")[0]);
    setClosureNote("");
  };

  const getCollateralIcon = (type: string) => {
    switch (type) {
      case "Gold":
        return <Diamond className="w-5 h-5 text-amber-500" />;
      case "Property":
        return <Home className="w-5 h-5 text-emerald-500" />;
      case "Vehicle":
        return <Car className="w-5 h-5 text-orange-500" />;
      default:
        return <ShieldCheck className="w-5 h-5 text-slate-400 dark:text-slate-500" />;
    }
  };

  const inputCls =
    "block w-full bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl py-3.5 px-4 font-mono text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/30 transition-all";
  const selectCls =
    "w-full bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl py-3.5 px-4 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/30";

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Loans
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {activeCount} active · {closedCount} closed
            </p>
          </div>
          <button
            onClick={handleOpenModal}
            className="tech-button-primary flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-widest"
          >
            <Plus className="w-4 h-4" /> New
          </button>
        </div>

        <div className="flex gap-2">
          <div className="flex bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 h-9 shrink-0">
            <button
              onClick={() => setStatusFilter("active")}
              className={`px-4 rounded-md text-[11px] font-bold tracking-wider uppercase transition-all flex items-center justify-center h-full ${statusFilter === "active" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-400 dark:text-slate-400"}`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter("closed")}
              className={`px-4 rounded-md text-[11px] font-bold tracking-wider uppercase transition-all flex items-center justify-center h-full ${statusFilter === "closed" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-400 dark:text-slate-400"}`}
            >
              Closed
            </button>
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input
              type="text"
              className="w-full bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-100 dark:focus:ring-sky-900/30 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3"
      >
        {filtered.map((l, index) => {
          const b = borrowers.find((x) => x.id === l.borrowerId);
          const isClosed = l.status === "closed";
          const totalEarned = isClosed
            ? interests.filter((i) => i.loanId === l.id).reduce((s, i) => s + i.amount, 0)
            : 0;
          const overdueMonths = !isClosed
            ? differenceInMonths(new Date(), new Date(l.lastPaymentDate))
            : 0;
          const pendingInterest =
            !isClosed && overdueMonths > 0
              ? calculateCompoundInterest(
                  l.principal,
                  l.rate,
                  new Date(l.lastPaymentDate),
                  new Date(),
                  Math.max(1, l.thresholdMonths),
                ).totalInterest
              : 0;
          const loanAgeMonths = differenceInMonths(new Date(), new Date(l.startDate));
          const agingColor = isClosed
            ? "bg-slate-300 dark:bg-slate-600"
            : loanAgeMonths >= 12
              ? "bg-gradient-to-b from-red-400 to-red-600"
              : loanAgeMonths >= 6
                ? "bg-gradient-to-b from-amber-400 to-amber-600"
                : "bg-gradient-to-b from-sky-400 to-blue-600";
          return (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              key={l.id}
              className={`bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/50 rounded-xl flex flex-col md:flex-row relative overflow-hidden transition-all group cursor-pointer ${isClosed ? "opacity-75" : ""}`}
              onClick={() => setQuickView(l)}
            >
              <div
                className={`absolute top-0 bottom-0 left-0 w-1.5 transition-colors ${agingColor}`}
              />

              {/* Left Section - Identity */}
              <div className="flex-[1.5] p-4 sm:p-5 flex flex-col justify-center border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-700/40 relative">
                {isClosed && (
                  <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-1">
                    <Lock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Closed
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-start mb-6">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] sm:text-xs uppercase font-bold tracking-widest text-slate-400 dark:text-slate-400">
                        Collateral ID
                      </span>
                      {overdueMonths > 0 && (
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${overdueMonths >= 6 ? "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400" : "bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"}`}
                        >
                          {overdueMonths}mo due
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-lg sm:text-xl font-black font-mono text-slate-900 dark:text-white leading-none transition-colors ${!isClosed ? "group-hover:text-blue-600 dark:group-hover:text-sky-400" : ""}`}
                    >
                      {l.collateralCode || "—"}
                    </span>
                  </div>
                  {getCollateralIcon(l.collateralType)}
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/40 rounded-xl p-4">
                  <span className="text-[10px] sm:text-xs uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500 block mb-1">
                    Borrower
                  </span>
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate block">
                    {b?.fullName || "Unknown"}
                  </span>
                </div>
              </div>

              {/* Right Section - Financials & Actions */}
              <div className="flex-[2] p-4 sm:p-5 flex flex-col justify-between">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] sm:text-xs uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500 block mb-1">
                      Principal Amount
                    </span>
                    <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight leading-none">
                      {m(l.principal)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] sm:text-xs uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500 block mb-1">
                      Monthly Rate
                    </span>
                    <span className="text-2xl sm:text-3xl font-black text-sky-600 dark:text-sky-400 font-mono tracking-tight leading-none">
                      {l.rate}%{" "}
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-sans tracking-normal">
                        / mo
                      </span>
                    </span>
                  </div>
                </div>

                {pendingInterest > 0 && (
                  <div className="mb-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-amber-600 dark:text-amber-400 block">
                        Pending Interest
                      </span>
                      <span className="text-[10px] text-amber-500 dark:text-amber-500/70">
                        as of today · {overdueMonths}mo unpaid
                      </span>
                    </div>
                    <span className="text-lg font-black text-amber-700 dark:text-amber-300 font-mono">
                      {m(pendingInterest, { decimals: 0 })}
                    </span>
                  </div>
                )}

                {isClosed && (
                  <div className="mb-6 grid grid-cols-2 gap-3">
                    {l.closedDate && (
                      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/40 rounded-xl p-3">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500 block mb-1">
                          Closed On
                        </span>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 font-mono">
                          {format(new Date(l.closedDate), "dd MMM yyyy")}
                        </span>
                        {l.closureNote && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 leading-relaxed truncate">
                            {l.closureNote}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 rounded-xl p-3">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-600 dark:text-emerald-400 block mb-1">
                        Interest Earned
                      </span>
                      <span className="text-sm font-black text-emerald-700 dark:text-emerald-300 font-mono">
                        {m(totalEarned)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => void handleLoanTicket(l)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-3 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-violet-50 dark:hover:bg-violet-900/15 hover:text-violet-600 dark:hover:text-violet-400 hover:border-violet-200 dark:hover:border-violet-500/40 transition-all"
                    title="Loan ticket"
                  >
                    <Ticket className="w-4 h-4" />
                  </button>
                  {isClosed ? (
                    <Link
                      to={`/history?loanId=${l.id}`}
                      className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                    >
                      <FileText className="w-4 h-4 opacity-70" /> View History Ledger
                    </Link>
                  ) : (
                    <>
                      <Link
                        to={`/interest?loanId=${l.id}`}
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-400 hover:border-emerald-200 dark:hover:border-emerald-500/40 transition-all"
                      >
                        <Terminal className="w-4 h-4 opacity-70" /> Interest
                      </Link>
                      <button
                        onClick={() => openClosureModal(l)}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/15 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800/40 transition-all"
                      >
                        <XCircle className="w-4 h-4 opacity-70" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <div className="w-full text-center py-20 bg-slate-50 dark:bg-slate-900/40 border border-dashed border-gray-200 dark:border-slate-700/40 rounded-2xl mt-4">
            <AlertOctagon className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-slate-500 dark:text-slate-300 font-bold tracking-widest uppercase mb-1">
              {statusFilter === "active" ? "No Active Loans" : "No Closed Loans"}
            </h3>
            <p className="text-slate-400 dark:text-slate-500 text-sm">
              {statusFilter === "active"
                ? "Create a new loan to get started."
                : "No loans have been closed yet."}
            </p>
          </div>
        )}
      </motion.div>

      {/* ─── New Loan Modal ─── */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-100 flex flex-col justify-end sm:justify-center items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm"
              onClick={() => setShowModal(false)}
            />
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl safe-area-bottom max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="p-5 sm:p-6 overflow-y-auto flex-1">
                <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-5 sm:hidden" />
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-5 tracking-tight flex items-center gap-3">
                  <span className="w-2.5 h-2.5 bg-sky-500 rounded-full animate-pulse" /> Add New
                  Loan
                </h3>

                {globalBorrowerId === null && borrowers.length > 0 ? (
                  <div className="p-6 bg-sky-50 dark:bg-sky-900/20 rounded-2xl border border-sky-200 dark:border-sky-700/50 flex flex-col items-center justify-center py-10 text-center">
                    <UserSquare2 className="w-10 h-10 text-sky-600 dark:text-sky-400 mb-4" />
                    <p className="text-base font-bold text-sky-700 dark:text-sky-300 uppercase tracking-widest mb-2">
                      Context Required
                    </p>
                    <p className="text-sm text-sky-600/70 dark:text-sky-400/60 mb-6 max-w-sm">
                      Please select a borrower from the top navbar.
                    </p>
                    <button
                      onClick={() => setShowModal(false)}
                      className="tech-button px-8 py-3 text-sm uppercase tracking-widest"
                    >
                      Close
                    </button>
                  </div>
                ) : borrowers.length === 0 ? (
                  <div className="p-6 bg-red-50 dark:bg-red-900/15 rounded-2xl border border-red-200 dark:border-red-800/40 flex flex-col items-center justify-center py-10 text-center">
                    <AlertOctagon className="w-10 h-10 text-red-500 mb-4" />
                    <p className="text-base font-bold text-red-600 dark:text-red-400 uppercase tracking-widest mb-2">
                      Cannot Proceed
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
                      Add at least one borrower first.
                    </p>
                    <button
                      onClick={() => setShowModal(false)}
                      className="tech-button px-8 py-3 text-sm uppercase tracking-widest"
                    >
                      Acknowledge
                    </button>
                  </div>
                ) : (
                  <form id="new-loan-form" onSubmit={handleAdd} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">
                          Borrower Context
                        </label>
                        <Select
                          value={newL.borrowerId}
                          onChange={(val) => setNewL({ ...newL, borrowerId: val })}
                          options={borrowers.map((b) => ({ value: b.id, label: b.fullName }))}
                          placeholder="Choose Borrower..."
                          disabled={!!globalBorrowerId}
                          buttonClassName={selectCls}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">
                          Principal Amount (₹)
                        </label>
                        <input
                          required
                          type="text"
                          inputMode="numeric"
                          placeholder="e.g. 1,50,000"
                          value={fmtNum(newL.principal)}
                          onChange={(e) =>
                            setNewL({ ...newL, principal: parseNum(e.target.value) })
                          }
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">
                          Monthly Rate (%)
                        </label>
                        <input
                          required
                          type="text"
                          inputMode="decimal"
                          placeholder="e.g. 2"
                          value={newL.rate || ""}
                          onChange={(e) => setNewL({ ...newL, rate: Number(e.target.value) || 0 })}
                          className={`${inputCls} text-sky-600 dark:text-sky-400`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">
                          Collateral Type
                        </label>
                        <Select
                          value={newL.collateralType}
                          onChange={(val) => setNewL({ ...newL, collateralType: val })}
                          options={[
                            { value: "Gold", label: "Gold" },
                            { value: "Property", label: "Property" },
                            { value: "Vehicle", label: "Vehicle" },
                            { value: "Other", label: "Other" },
                          ]}
                          buttonClassName={selectCls}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">
                          Collateral ID
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400 dark:text-slate-500 pointer-events-none">
                            JB-{typePrefix[newL.collateralType] || "OTH"}-
                          </span>
                          <input
                            required
                            type="text"
                            value={newL.collateralCode}
                            onChange={(e) => setNewL({ ...newL, collateralCode: e.target.value })}
                            placeholder="e.g. 9015"
                            className={`${inputCls} placeholder:text-slate-400 dark:placeholder:text-slate-500`}
                            style={{
                              paddingLeft: `${(typePrefix[newL.collateralType]?.length || 3) * 8 + 44}px`,
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 ml-1 font-mono">
                          Full code: JB-{typePrefix[newL.collateralType] || "OTH"}-
                          {newL.collateralCode || "..."}-#
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">
                          Start Date
                        </label>
                        <input
                          required
                          type="date"
                          value={newL.startDate}
                          onChange={(e) => setNewL({ ...newL, startDate: e.target.value })}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-2">
                          Penalty Threshold <span className="opacity-50">(Months)</span>
                        </label>
                        <input
                          required
                          type="text"
                          inputMode="numeric"
                          placeholder="e.g. 12"
                          value={newL.thresholdMonths || ""}
                          onChange={(e) =>
                            setNewL({ ...newL, thresholdMonths: Number(e.target.value) || 0 })
                          }
                          className={`${inputCls} text-red-600 dark:text-red-400`}
                        />
                      </div>
                    </div>
                  </form>
                )}
              </div>
              <div className="border-t border-slate-100 dark:border-slate-700/50 flex shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3.5 text-xs font-bold tracking-widest uppercase text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-r border-slate-100 dark:border-slate-700/50 rounded-none rounded-bl-2xl sm:rounded-bl-2xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="new-loan-form"
                  className="flex-1 py-3.5 text-xs font-bold tracking-widest uppercase text-white bg-sky-600 hover:bg-sky-700 transition-colors rounded-none rounded-br-2xl sm:rounded-br-2xl"
                >
                  Save Loan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Close Loan Modal ─── */}
      <AnimatePresence>
        {closureTarget && (
          <div className="fixed inset-0 z-100 flex flex-col justify-end sm:justify-center items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm"
              onClick={() => setClosureTarget(null)}
            />
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl safe-area-bottom max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="p-5 sm:p-6 overflow-y-auto flex-1">
                <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-5 sm:hidden" />

                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 flex items-center justify-center">
                    <XCircle className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                      Close Loan
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-mono tracking-wider mt-0.5">
                      {closureTarget.collateralCode || "—"} —{" "}
                      {borrowers.find((b) => b.id === closureTarget.borrowerId)?.fullName}
                    </p>
                  </div>
                </div>

                {/* Settlement Summary */}
                <div className="space-y-3 mb-6">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700/40 rounded-xl p-4">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">
                        Loan Started
                      </span>
                      <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                        {format(new Date(closureTarget.startDate), "dd MMM yyyy")}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700/40 rounded-xl p-4">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">
                        Principal
                      </span>
                      <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                        {m(closureTarget.principal)}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700/40 rounded-xl p-4">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">
                        Collected
                      </span>
                      <span className="text-sm font-black text-sky-600 dark:text-sky-400 font-mono">
                        {m(closureCalc?.totalCollected || 0)}
                      </span>
                    </div>
                  </div>

                  {closureCalc?.valid && (
                    <div className="bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4">
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest block mb-1">
                        Unpaid Interest (Up to Closure)
                      </span>
                      <span className="text-lg font-black text-amber-700 dark:text-amber-300 font-mono">
                        {m(closureCalc.unpaidInterest, { decimals: 2 })}
                      </span>
                    </div>
                  )}

                  <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-700/50 rounded-xl p-4">
                    <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest block mb-1">
                      Final Settlement Amount
                    </span>
                    <span className="text-2xl font-black text-sky-700 dark:text-sky-300 font-mono">
                      {m(closureCalc?.settlement || closureTarget.principal, { decimals: 2 })}
                    </span>
                    <p className="text-[10px] text-sky-500 dark:text-sky-400/60 mt-1 tracking-wide">
                      Principal + Unpaid Interest
                    </p>
                  </div>
                </div>

                {/* Closure Date */}
                <div className="space-y-5 mb-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" /> Closure Date
                    </label>
                    <input
                      type="date"
                      value={closureDate}
                      onChange={(e) => setClosureDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5" /> Note{" "}
                      <span className="text-slate-300 dark:text-slate-600 font-mono text-[10px]">
                        OPTIONAL
                      </span>
                    </label>
                    <textarea
                      value={closureNote}
                      onChange={(e) => setClosureNote(e.target.value)}
                      rows={2}
                      placeholder="e.g. Full settlement received via NEFT"
                      className={`${inputCls} font-sans resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500`}
                    />
                  </div>
                </div>
              </div>
              {/* Actions */}
              <div className="border-t border-slate-100 dark:border-slate-700/50 flex shrink-0">
                <button
                  type="button"
                  onClick={() => setClosureTarget(null)}
                  className="flex-1 py-3.5 text-xs font-bold tracking-widest uppercase text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-r border-slate-100 dark:border-slate-700/50 rounded-none rounded-bl-2xl sm:rounded-bl-2xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCloseLoan}
                  className="flex-1 py-3.5 text-xs font-bold tracking-widest uppercase text-white bg-red-500 hover:bg-red-600 transition-colors rounded-none rounded-br-2xl sm:rounded-br-2xl flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" /> Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick View bottom sheet */}
      <AnimatePresence>
        {quickView &&
          (() => {
            const qb = borrowers.find((x) => x.id === quickView.borrowerId);
            const qClosed = quickView.status === "closed";
            const qOverdue = !qClosed
              ? differenceInMonths(new Date(), new Date(quickView.lastPaymentDate))
              : 0;
            const qCalc =
              !qClosed && qOverdue > 0
                ? calculateCompoundInterest(
                    quickView.principal,
                    quickView.rate,
                    new Date(quickView.lastPaymentDate),
                    new Date(),
                    Math.max(1, quickView.thresholdMonths),
                  )
                : null;
            const qEarned = interests
              .filter((i) => i.loanId === quickView.id)
              .reduce((s, i) => s + i.amount, 0);
            return (
              <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center items-center sm:p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
                  onClick={() => setQuickView(null)}
                />
                <motion.div
                  initial={{ y: "100%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "100%", opacity: 0 }}
                  transition={{ type: "spring", damping: 28, stiffness: 220 }}
                  className="relative w-full max-w-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl safe-area-bottom max-h-[85vh] flex flex-col overflow-hidden"
                >
                  <div className="p-5 sm:p-6 overflow-y-auto flex-1">
                    <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />

                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black font-mono text-slate-900 dark:text-white">
                            {quickView.collateralCode || "—"}
                          </span>
                          {qClosed && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Closed
                            </span>
                          )}
                          {qOverdue > 0 && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${qOverdue >= 6 ? "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400" : "bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"}`}
                            >
                              {qOverdue}mo due
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          {qb?.fullName || "Unknown"}
                        </p>
                      </div>
                      {getCollateralIcon(quickView.collateralType)}
                    </div>

                    {/* Key stats */}
                    <div className="grid grid-cols-3 gap-2.5 mb-4">
                      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/40 rounded-xl p-3 text-center">
                        <div className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold mb-1">
                          Principal
                        </div>
                        <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
                          {m(quickView.principal)}
                        </div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/40 rounded-xl p-3 text-center">
                        <div className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold mb-1">
                          Rate
                        </div>
                        <div className="text-sm font-black text-sky-600 dark:text-sky-400 font-mono">
                          {quickView.rate}%/mo
                        </div>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 rounded-xl p-3 text-center">
                        <div className="text-[9px] text-emerald-600 dark:text-emerald-400 uppercase tracking-widest font-bold mb-1">
                          Earned
                        </div>
                        <div className="text-sm font-black text-emerald-700 dark:text-emerald-300 font-mono">
                          {m(qEarned)}
                        </div>
                      </div>
                    </div>

                    {/* Pending breakdown */}
                    {qCalc && qCalc.periods.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                            Pending Breakdown
                          </span>
                          <span className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
                            {m(qCalc.totalInterest, { decimals: 0 })}
                          </span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/40 rounded-xl overflow-hidden">
                          {qCalc.periods.map((p, idx) => (
                            <div
                              key={idx}
                              className={`flex items-center justify-between px-3 py-2 ${idx < qCalc.periods.length - 1 ? "border-b border-slate-100 dark:border-slate-700/30" : ""}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-500 dark:text-slate-400">
                                  {idx + 1}
                                </span>
                                <div>
                                  <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
                                    {format(p.startDate, "dd MMM")} →{" "}
                                    {format(p.endDate, "dd MMM yy")}
                                  </span>
                                  {p.label !== "1 Month" && (
                                    <span className="text-[9px] text-slate-400 dark:text-slate-500 ml-1.5">
                                      {p.label}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="text-xs font-black text-slate-900 dark:text-white font-mono">
                                {m(p.amount, { decimals: 0 })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Closed info */}
                    {qClosed && quickView.closedDate && (
                      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/40 rounded-xl p-3 mb-4">
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold block mb-1">
                          Closed On
                        </span>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 font-mono">
                          {format(new Date(quickView.closedDate), "dd MMM yyyy")}
                        </span>
                        {quickView.closureNote && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                            {quickView.closureNote}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-4 text-[10px] text-slate-400 dark:text-slate-500">
                      <span>
                        Started:{" "}
                        <span className="font-mono font-semibold text-slate-500 dark:text-slate-400">
                          {format(new Date(quickView.startDate), "dd MMM yyyy")}
                        </span>
                      </span>
                      <span>
                        Paid till:{" "}
                        <span className="font-mono font-semibold text-slate-500 dark:text-slate-400">
                          {format(new Date(quickView.lastPaymentDate), "dd MMM yyyy")}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="border-t border-slate-100 dark:border-slate-700/50 flex shrink-0">
                    <button
                      onClick={() => {
                        setDeleteTarget(quickView);
                        setQuickView(null);
                      }}
                      className="py-3.5 px-4 text-xs font-bold tracking-widest uppercase text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/15 hover:text-red-500 dark:hover:text-red-400 transition-colors border-r border-slate-100 dark:border-slate-700/50 rounded-none rounded-bl-2xl sm:rounded-bl-2xl flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setQuickView(null)}
                      className="flex-1 py-3.5 text-xs font-bold tracking-widest uppercase text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-r border-slate-100 dark:border-slate-700/50"
                    >
                      Close
                    </button>
                    {!qClosed && qCalc && qCalc.periods.length > 0 && (
                      <>
                        <button
                          onClick={() => void handleSharePending(quickView)}
                          className="py-3.5 px-4 text-xs font-bold tracking-widest uppercase text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-900/15 hover:text-sky-600 dark:hover:text-sky-400 transition-colors border-r border-slate-100 dark:border-slate-700/50 flex items-center justify-center gap-1.5"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => void handleDownloadPending(quickView)}
                          className="py-3.5 px-4 text-xs font-bold tracking-widest uppercase text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/15 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors border-r border-slate-100 dark:border-slate-700/50 flex items-center justify-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {!qClosed ? (
                      <Link
                        to={`/interest?loanId=${quickView.id}`}
                        onClick={() => setQuickView(null)}
                        className="flex-1 py-3.5 text-xs font-bold tracking-widest uppercase text-white bg-sky-600 hover:bg-sky-700 transition-colors rounded-none rounded-br-2xl sm:rounded-br-2xl flex items-center justify-center gap-2"
                      >
                        <Terminal className="w-3.5 h-3.5" /> Interest
                      </Link>
                    ) : (
                      <Link
                        to={`/history?loanId=${quickView.id}`}
                        onClick={() => setQuickView(null)}
                        className="flex-1 py-3.5 text-xs font-bold tracking-widest uppercase text-white bg-sky-600 hover:bg-sky-700 transition-colors rounded-none rounded-br-2xl sm:rounded-br-2xl flex items-center justify-center gap-2"
                      >
                        <FileText className="w-3.5 h-3.5" /> History
                      </Link>
                    )}
                  </div>
                </motion.div>
              </div>
            );
          })()}
      </AnimatePresence>

      {/* Delete loan confirmation */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
              onClick={() => setDeleteTarget(null)}
            />
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl safe-area-bottom flex flex-col overflow-hidden"
            >
              <div className="p-5 sm:p-6 flex-1">
                <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-5 sm:hidden" />
                <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4 border border-red-200 dark:border-red-800/40 mx-auto">
                  <Trash2 className="w-7 h-7 text-red-500" />
                </div>
                <h3 className="text-lg font-black text-center text-slate-900 dark:text-white tracking-tight mb-2">
                  Delete Loan Permanently
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm text-center leading-relaxed mb-3">
                  This will permanently delete{" "}
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                    {deleteTarget.collateralCode || "—"}
                  </span>{" "}
                  and all its interest records. This action cannot be undone.
                </p>
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/30 rounded-xl p-3 text-center">
                  <span className="text-xs text-red-600 dark:text-red-400 font-semibold">
                    {interests.filter((i) => i.loanId === deleteTarget.id).length} interest
                    record(s) will also be deleted
                  </span>
                </div>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-700/50 flex shrink-0">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-3.5 text-xs font-bold tracking-widest uppercase text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-r border-slate-100 dark:border-slate-700/50 rounded-none rounded-bl-2xl sm:rounded-bl-2xl"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    deleteLoan(deleteTarget.id);
                    setDeleteTarget(null);
                    toast.success(`Loan ${deleteTarget.id} permanently deleted.`);
                  }}
                  className="flex-1 py-3.5 text-xs font-bold tracking-widest uppercase text-white bg-red-500 hover:bg-red-600 transition-colors rounded-none rounded-br-2xl sm:rounded-br-2xl"
                >
                  Delete Forever
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden pending interest ticket for image share */}
      {shareTarget &&
        (() => {
          const sb = borrowers.find((x) => x.id === shareTarget.borrowerId);
          const sOverdue = differenceInMonths(new Date(), new Date(shareTarget.lastPaymentDate));
          const sCalc = calculateCompoundInterest(
            shareTarget.principal,
            shareTarget.rate,
            new Date(shareTarget.lastPaymentDate),
            new Date(),
            Math.max(1, shareTarget.thresholdMonths),
          );
          return (
            <div className="fixed -left-[9999px] top-0">
              <div
                ref={pendingCardRef}
                style={{
                  width: 400,
                  fontFamily: "Inter, system-ui, sans-serif",
                  background: "#f1f5f9",
                  padding: 20,
                }}
              >
                {/* Top section — dark */}
                <div
                  style={{
                    background: "#0f172a",
                    borderRadius: "20px 20px 0 0",
                    padding: "24px 24px 20px",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: -30,
                      right: -30,
                      width: 120,
                      height: 120,
                      borderRadius: "50%",
                      background: "rgba(245,158,11,0.06)",
                    }}
                  />

                  {/* Brand */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 20,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 7,
                          background: "linear-gradient(135deg, #fbbf24, #d97706)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span style={{ color: "#fff", fontWeight: 900, fontSize: 13 }}>₹</span>
                      </div>
                      <span
                        style={{
                          color: "#fff",
                          fontWeight: 900,
                          fontSize: 13,
                          letterSpacing: -0.3,
                        }}
                      >
                        JB FINANCE
                      </span>
                    </div>
                    <span
                      style={{
                        color: "#f59e0b",
                        fontSize: 8,
                        fontWeight: 700,
                        letterSpacing: 3,
                        textTransform: "uppercase",
                        background: "rgba(245,158,11,0.1)",
                        padding: "3px 8px",
                        borderRadius: 20,
                      }}
                    >
                      Pending
                    </span>
                  </div>

                  {/* Borrower */}
                  <div style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        color: "#64748b",
                        fontSize: 8,
                        textTransform: "uppercase",
                        letterSpacing: 3,
                        marginBottom: 3,
                      }}
                    >
                      Borrower
                    </div>
                    <div
                      style={{ color: "#fff", fontSize: 20, fontWeight: 900, letterSpacing: -0.5 }}
                    >
                      {sb?.fullName || "Unknown"}
                    </div>
                  </div>

                  {/* Loan details */}
                  <div style={{ display: "flex", gap: 10 }}>
                    {[
                      { label: "Collateral", value: shareTarget.collateralCode || "—" },
                      {
                        label: "Principal",
                        value: `₹${shareTarget.principal.toLocaleString("en-IN")}`,
                      },
                      { label: "Rate", value: `${shareTarget.rate}%/mo` },
                    ].map((item) => (
                      <div
                        key={item.label}
                        style={{
                          flex: 1,
                          background: "rgba(255,255,255,0.05)",
                          borderRadius: 8,
                          padding: "8px 10px",
                        }}
                      >
                        <div
                          style={{
                            color: "#64748b",
                            fontSize: 7,
                            textTransform: "uppercase",
                            letterSpacing: 2,
                            marginBottom: 2,
                          }}
                        >
                          {item.label}
                        </div>
                        <div
                          style={{
                            color: "#e2e8f0",
                            fontSize: 11,
                            fontWeight: 800,
                            fontFamily: "monospace",
                          }}
                        >
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tear line */}
                <div style={{ position: "relative", height: 22, background: "#f1f5f9" }}>
                  <div
                    style={{
                      position: "absolute",
                      left: -11,
                      top: -11,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "#f1f5f9",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      right: -11,
                      top: -11,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "#f1f5f9",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: 18,
                      right: 18,
                      borderTop: "2px dashed #cbd5e1",
                    }}
                  />
                </div>

                {/* Bottom section — white with row-wise breakdown */}
                <div
                  style={{
                    background: "#fff",
                    borderRadius: "0 0 20px 20px",
                    padding: "16px 24px 24px",
                  }}
                >
                  {/* Period rows */}
                  <div
                    style={{
                      fontSize: 8,
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      letterSpacing: 3,
                      marginBottom: 8,
                      fontWeight: 700,
                    }}
                  >
                    Month-wise Breakdown
                  </div>
                  {sCalc.periods.map((p, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "7px 0",
                        borderBottom: idx < sCalc.periods.length - 1 ? "1px solid #f1f5f9" : "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "#f1f5f9",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 8,
                            fontWeight: 800,
                            color: "#64748b",
                          }}
                        >
                          {idx + 1}
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: "#334155", fontFamily: "monospace" }}>
                            {format(p.startDate, "dd MMM yy")} → {format(p.endDate, "dd MMM yy")}
                          </div>
                          <div style={{ fontSize: 8, color: "#94a3b8" }}>
                            {p.label} · Base: ₹{p.principalAtTime.toLocaleString("en-IN")}
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 900,
                          color: "#0f172a",
                          fontFamily: "monospace",
                        }}
                      >
                        ₹{Math.round(p.amount).toLocaleString("en-IN")}
                      </div>
                    </div>
                  ))}

                  {/* Total bar */}
                  <div
                    style={{
                      marginTop: 14,
                      background: "linear-gradient(135deg, #0f172a, #1e293b)",
                      borderRadius: 10,
                      padding: "12px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 7,
                          color: "#64748b",
                          textTransform: "uppercase",
                          letterSpacing: 3,
                          marginBottom: 2,
                        }}
                      >
                        Total Pending
                      </div>
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 900,
                          color: "#f59e0b",
                          fontFamily: "monospace",
                          letterSpacing: -1,
                        }}
                      >
                        ₹{Math.round(sCalc.totalInterest).toLocaleString("en-IN")}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 7,
                          color: "#64748b",
                          textTransform: "uppercase",
                          letterSpacing: 3,
                          marginBottom: 2,
                        }}
                      >
                        {sOverdue}mo unpaid
                      </div>
                      <div style={{ fontSize: 9, color: "#94a3b8" }}>
                        since {format(new Date(shareTarget.lastPaymentDate), "dd MMM yyyy")}
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div
                    style={{
                      textAlign: "center",
                      paddingTop: 10,
                      marginTop: 12,
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
          );
        })()}

      {/* Hidden loan acknowledgment slip */}
      {loanTicketTarget &&
        (() => {
          const tb = borrowers.find((x) => x.id === loanTicketTarget.borrowerId);
          const row = (label: string, value: string) => (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                padding: "9px 0",
                borderBottom: "1px dashed #e2e8f0",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  fontWeight: 600,
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#0f172a",
                  fontFamily: "monospace",
                  textAlign: "right",
                }}
              >
                {value}
              </span>
            </div>
          );
          return (
            <div className="fixed -left-[9999px] top-0">
              <div
                ref={loanTicketRef}
                style={{ width: 380, fontFamily: "Inter, system-ui, sans-serif", padding: 16 }}
              >
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 16,
                    overflow: "hidden",
                    boxShadow: "0 2px 20px rgba(0,0,0,0.06)",
                  }}
                >
                  {/* Gold accent bar */}
                  <div
                    style={{
                      height: 5,
                      background: "linear-gradient(90deg, #fbbf24, #d97706, #fbbf24)",
                    }}
                  />

                  {/* Header */}
                  <div
                    style={{
                      padding: "20px 24px 16px",
                      textAlign: "center",
                      borderBottom: "2px solid #f1f5f9",
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #fbbf24, #d97706)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 10px",
                        boxShadow: "0 4px 12px rgba(217,119,6,0.25)",
                      }}
                    >
                      <span style={{ color: "#fff", fontWeight: 900, fontSize: 18 }}>₹</span>
                    </div>
                    <div
                      style={{ fontSize: 14, fontWeight: 900, color: "#0f172a", letterSpacing: 1 }}
                    >
                      JB FINANCE
                    </div>
                    <div
                      style={{
                        fontSize: 8,
                        color: "#d97706",
                        letterSpacing: 4,
                        textTransform: "uppercase",
                        fontWeight: 700,
                        marginTop: 4,
                        background: "#fef3c7",
                        display: "inline-block",
                        padding: "3px 12px",
                        borderRadius: 20,
                      }}
                    >
                      Loan Acknowledgment
                    </div>
                  </div>

                  {/* Borrower hero */}
                  <div
                    style={{
                      padding: "16px 24px",
                      background: "#fafaf9",
                      borderBottom: "2px solid #f1f5f9",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 8,
                        color: "#a8a29e",
                        textTransform: "uppercase",
                        letterSpacing: 3,
                        marginBottom: 4,
                        fontWeight: 600,
                      }}
                    >
                      Issued To
                    </div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 900,
                        color: "#0f172a",
                        letterSpacing: -0.5,
                      }}
                    >
                      {tb?.fullName || "Unknown"}
                    </div>
                  </div>

                  {/* Receipt rows */}
                  <div style={{ padding: "4px 24px 12px" }}>
                    {row("Ref. No.", loanTicketTarget.collateralCode || "—")}
                    {row("Amount", `₹${loanTicketTarget.principal.toLocaleString("en-IN")}`)}
                    {row("Interest", `${loanTicketTarget.rate}% per month`)}
                    {row(
                      "Security",
                      `${loanTicketTarget.collateralType} · ${loanTicketTarget.collateralCode || "—"}`,
                    )}
                    {row("Date", format(new Date(loanTicketTarget.startDate), "dd MMM yyyy"))}
                  </div>

                  {/* Stamp area */}
                  <div
                    style={{
                      padding: "12px 24px 18px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-end",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 8,
                        color: "#a8a29e",
                        letterSpacing: 2,
                        textTransform: "uppercase",
                      }}
                    >
                      {format(new Date(), "dd MMM yyyy • hh:mm a")}
                    </div>
                    {/* Wavy seal stamp */}
                    <svg
                      width="74"
                      height="74"
                      viewBox="0 0 74 74"
                      style={{ transform: "rotate(-12deg)" }}
                    >
                      <defs>
                        <clipPath id="wavyClip">
                          <path
                            d={(() => {
                              const cx = 37,
                                cy = 37,
                                points = 32,
                                rOuter = 35,
                                rInner = 31;
                              let d = "";
                              for (let i = 0; i < points; i++) {
                                const angle = (i / points) * Math.PI * 2;
                                const r = i % 2 === 0 ? rOuter : rInner;
                                const x = cx + r * Math.cos(angle);
                                const y = cy + r * Math.sin(angle);
                                d += (i === 0 ? "M" : "L") + `${x.toFixed(1)},${y.toFixed(1)}`;
                              }
                              return d + "Z";
                            })()}
                          />
                        </clipPath>
                      </defs>
                      {/* Wavy outer shape — filled */}
                      <path
                        fill="#92400e"
                        d={(() => {
                          const cx = 37,
                            cy = 37,
                            points = 32,
                            rOuter = 35,
                            rInner = 31;
                          let d = "";
                          for (let i = 0; i < points; i++) {
                            const angle = (i / points) * Math.PI * 2;
                            const r = i % 2 === 0 ? rOuter : rInner;
                            const x = cx + r * Math.cos(angle);
                            const y = cy + r * Math.sin(angle);
                            d += (i === 0 ? "M" : "L") + `${x.toFixed(1)},${y.toFixed(1)}`;
                          }
                          return d + "Z";
                        })()}
                      />
                      {/* Inner ring */}
                      <circle
                        cx="37"
                        cy="37"
                        r="25"
                        fill="none"
                        stroke="#fef3c7"
                        strokeWidth="1.2"
                        opacity="0.4"
                      />
                      {/* Top arc text */}
                      <path id="sealTop" d="M 12,37 a 25,25 0 1,1 50,0" fill="none" />
                      <text
                        fill="#fef3c7"
                        fontSize="5.5"
                        fontWeight="800"
                        letterSpacing="3"
                        fontFamily="system-ui,sans-serif"
                        opacity="0.9"
                      >
                        <textPath href="#sealTop" startOffset="50%" textAnchor="middle">
                          JB FINANCE
                        </textPath>
                      </text>
                      {/* Bottom arc text */}
                      <path id="sealBot" d="M 12,37 a 25,25 0 1,0 50,0" fill="none" />
                      <text
                        fill="#fef3c7"
                        fontSize="4.5"
                        fontWeight="700"
                        letterSpacing="3"
                        fontFamily="system-ui,sans-serif"
                        opacity="0.9"
                      >
                        <textPath href="#sealBot" startOffset="50%" textAnchor="middle">
                          ★ ACKNOWLEDGED ★
                        </textPath>
                      </text>
                      {/* Center ₹ */}
                      <text
                        x="37"
                        y="44"
                        textAnchor="middle"
                        fill="#fef3c7"
                        fontSize="20"
                        fontWeight="900"
                        fontFamily="system-ui,sans-serif"
                      >
                        ₹
                      </text>
                    </svg>
                  </div>

                  {/* Gold accent bar bottom */}
                  <div
                    style={{
                      height: 5,
                      background: "linear-gradient(90deg, #fbbf24, #d97706, #fbbf24)",
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
