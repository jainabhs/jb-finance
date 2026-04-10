import React, { useState, useEffect } from "react";
import { Search, Plus, Phone, Mail, ShieldCheck, Edit3 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMockData } from "../lib/MockContext";
import { usePrivacy } from "../lib/PrivacyContext";
import { calculateCompoundInterest } from "../lib/interest";
import { lockScroll } from "../lib/utils";
import toast from "react-hot-toast";

export default function ManageBorrowers() {
  const { borrowers, loans, interests, addBorrower, updateBorrower } = useMockData();
  const { m } = usePrivacy();
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editBId, setEditBId] = useState<string | null>(null);
  const [newB, setNewB] = useState({ fullName: "", phone: "", email: "" });

  useEffect(() => {
    lockScroll(showModal);
    return () => lockScroll(false);
  }, [showModal]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newB.fullName) {
      if (editBId) {
        updateBorrower(editBId, newB);
        toast.success("Borrower updated!");
      } else {
        addBorrower(newB);
        toast.success("Borrower added!");
      }
      setShowModal(false);
      setNewB({ fullName: "", phone: "", email: "" });
      setEditBId(null);
    }
  };
  const openAddModal = () => {
    setEditBId(null);
    setNewB({ fullName: "", phone: "", email: "" });
    setShowModal(true);
  };
  const openEditModal = (b: any) => {
    setEditBId(b.id);
    setNewB({ fullName: b.fullName, phone: b.phone, email: b.email || "" });
    setShowModal(true);
  };
  const filtered = borrowers.filter(
    (b) =>
      b.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || b.phone.includes(searchQuery),
  );

  const inputCls =
    "block w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg py-2.5 px-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/30 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500";

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Borrowers
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {borrowers.length} registered
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="tech-button-primary flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold tracking-wide"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            type="text"
            className="w-full bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/30 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
            placeholder="Search name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div className="space-y-2.5">
        {filtered.map((b, index) => {
          const borrowerLoans = loans.filter((l) => l.borrowerId === b.id);
          const activeCount = borrowerLoans.filter((l) => l.status === "active").length;
          const principalOut = borrowerLoans
            .filter((l) => l.status === "active")
            .reduce((s, l) => s + l.principal, 0);
          const totalEarned = interests
            .filter((i) => borrowerLoans.some((l) => l.id === i.loanId))
            .reduce((s, i) => s + i.amount, 0);
          const pendingInterest = borrowerLoans
            .filter((l) => l.status === "active")
            .reduce((s, l) => {
              const start = new Date(l.lastPaymentDate);
              const now = new Date();
              if (now <= start) return s;
              return (
                s +
                calculateCompoundInterest(
                  l.principal,
                  l.rate,
                  start,
                  now,
                  Math.max(1, l.thresholdMonths),
                ).totalInterest
              );
            }, 0);
          const initials = b.fullName
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          return (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.25 }}
              className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/50 rounded-xl p-3.5 sm:p-4 flex items-center gap-3 hover:shadow-md dark:hover:shadow-slate-950/30 transition-all"
            >
              {/* Avatar */}
              <div className="w-11 h-11 shrink-0 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-sm">
                <span className="text-xs font-black text-white tracking-wider">{initials}</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {b.fullName}
                  </span>
                  {activeCount > 0 && (
                    <span className="text-[9px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 px-1.5 py-0.5 rounded-full shrink-0">
                      {activeCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {b.phone}
                  </span>
                  {b.email && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 truncate hidden sm:flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {b.email}
                    </span>
                  )}
                </div>
                {principalOut > 0 && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      Out:{" "}
                      <span className="font-mono font-semibold text-slate-600 dark:text-slate-300">
                        {m(principalOut)}
                      </span>
                    </span>
                    {pendingInterest > 0 && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400">
                        Pending:{" "}
                        <span className="font-mono font-semibold">
                          {m(pendingInterest, { decimals: 0 })}
                        </span>
                      </span>
                    )}
                    {totalEarned > 0 && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        Earned:{" "}
                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {m(totalEarned)}
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Edit */}
              <button
                onClick={() => openEditModal(b)}
                className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:text-sky-500 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <ShieldCheck className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            No borrowers found
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Add a borrower to get started
          </p>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex flex-col justify-end lg:justify-center items-center lg:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
              onClick={() => setShowModal(false)}
            />
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="relative w-full lg:max-w-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-t-2xl lg:rounded-2xl shadow-2xl safe-area-bottom max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="lg:hidden w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600 mx-auto mt-2.5 mb-1 shrink-0" />
              <div className="p-5 sm:p-6 overflow-y-auto flex-1">
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-5 tracking-tight">
                  {editBId ? "Edit Borrower" : "Add Borrower"}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide mb-1.5">
                      Full Name
                    </label>
                    <input
                      required
                      form="borrower-form"
                      type="text"
                      value={newB.fullName}
                      onChange={(e) => setNewB({ ...newB, fullName: e.target.value })}
                      className={inputCls}
                      placeholder="Enter name..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide mb-1.5">
                      Phone
                    </label>
                    <input
                      required
                      form="borrower-form"
                      type="text"
                      value={newB.phone}
                      onChange={(e) => setNewB({ ...newB, phone: e.target.value })}
                      className={`${inputCls} font-mono`}
                      placeholder="+91 99999 99999"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide mb-1.5">
                      Email{" "}
                      <span className="text-slate-300 dark:text-slate-600 font-mono text-[10px]">
                        optional
                      </span>
                    </label>
                    <input
                      form="borrower-form"
                      type="email"
                      value={newB.email}
                      onChange={(e) => setNewB({ ...newB, email: e.target.value })}
                      className={inputCls}
                      placeholder="email@domain.com"
                    />
                  </div>
                </div>
              </div>
              <form id="borrower-form" onSubmit={handleSubmit} />
              <div className="border-t border-slate-100 dark:border-slate-700/50 flex shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3.5 text-xs font-bold tracking-widest uppercase text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-r border-slate-100 dark:border-slate-700/50 rounded-none lg:rounded-bl-2xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="borrower-form"
                  className="flex-1 py-3.5 text-xs font-bold tracking-widest uppercase text-white bg-sky-600 hover:bg-sky-700 transition-colors rounded-none lg:rounded-br-2xl"
                >
                  {editBId ? "Save" : "Add"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
