import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "./supabase";

export interface Borrower {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  createdAt: string;
}
export interface Loan {
  id: string;
  borrowerId: string;
  principal: number;
  rate: number;
  startDate: string;
  status: "active" | "closed" | "defaulted";
  collateralType: string;
  collateralCode: string;
  thresholdMonths: number;
  lastPaymentDate: string;
  closedDate?: string;
  closureNote?: string;
}
export interface AppliedInterest {
  id: string;
  loanId: string;
  startDate: string;
  endDate: string;
  amount: number;
  createdAt: string;
  previousPrincipal?: number;
}

interface MockDataState {
  borrowers: Borrower[];
  loans: Loan[];
  interests: AppliedInterest[];
  addBorrower: (b: Omit<Borrower, "id" | "createdAt">) => Promise<void> | void;
  updateBorrower: (
    id: string,
    updates: Partial<Omit<Borrower, "id" | "createdAt">>,
  ) => Promise<void> | void;
  addLoan: (
    l: Omit<Loan, "id" | "createdAt" | "status" | "lastPaymentDate">,
  ) => Promise<void> | void;
  addInterest: (i: {
    loanId: string;
    startDate: string;
    endDate: string;
    amount: number;
    newPrincipal: number;
  }) => Promise<void> | void;
  deleteInterest: (id: string) => Promise<void> | void;
  closeLoan: (id: string, closedDate: string, note?: string) => Promise<void> | void;
  deleteLoan: (id: string) => Promise<void> | void;
  clearWorkspace: () => Promise<void> | void;
  globalBorrowerId: string | null;
  setGlobalBorrowerId: (id: string | null) => void;
  isSupabaseConnected: boolean;
}

// ── Supabase row ↔ App model mappers ──

function borrowerFromRow(r: any): Borrower {
  return {
    id: r.id,
    fullName: r.full_name,
    phone: r.phone_number ?? "",
    email: r.email ?? "",
    createdAt: r.created_at,
  };
}
function borrowerToRow(b: Record<string, unknown>) {
  const row: Record<string, unknown> = {};
  if ("fullName" in b) row.full_name = b.fullName;
  if ("phone" in b) row.phone_number = b.phone;
  if ("email" in b) row.email = b.email;
  if ("id" in b) row.id = b.id;
  return row;
}

function loanFromRow(r: any): Loan {
  return {
    id: r.id,
    borrowerId: r.borrower_id,
    principal: Number(r.principal_amount),
    rate: Number(r.interest_rate_monthly),
    startDate: r.start_date,
    status: r.status,
    collateralType: r.collateral_type ?? "",
    collateralCode: r.collateral_code ?? "",
    thresholdMonths: r.compound_threshold_months ?? 12,
    lastPaymentDate: r.last_payment_date ?? r.start_date,
    closedDate: r.closed_date,
    closureNote: r.closure_note,
  };
}
function interestFromRow(r: any): AppliedInterest {
  return {
    id: r.id,
    loanId: r.loan_id,
    startDate: r.period_start,
    endDate: r.period_end,
    amount: Number(r.interest_amount),
    createdAt: r.created_at,
    previousPrincipal: r.previous_principal != null ? Number(r.previous_principal) : undefined,
  };
}
const MockContext = createContext<MockDataState | null>(null);

export function MockProvider({ children }: { children: React.ReactNode }) {
  const isSupabaseConnected = !!supabase;

  // If Supabase is connected, initialize with empty arrays and fetch, otherwise use localstorage
  const [borrowers, setBorrowers] = useState<Borrower[]>(() =>
    isSupabaseConnected ? [] : JSON.parse(localStorage.getItem("nk_borrowers") || "[]"),
  );
  const [loans, setLoans] = useState<Loan[]>(() =>
    isSupabaseConnected ? [] : JSON.parse(localStorage.getItem("nk_loans") || "[]"),
  );
  const [interests, setInterests] = useState<AppliedInterest[]>(() =>
    isSupabaseConnected ? [] : JSON.parse(localStorage.getItem("nk_interests") || "[]"),
  );
  const [globalBorrowerId, setGlobalBorrowerId] = useState<string | null>(
    () => localStorage.getItem("nk_global_borrower") || null,
  );

  // Fetch initial data from Supabase
  useEffect(() => {
    if (isSupabaseConnected && supabase) {
      const db = supabase;
      const fetchData = async () => {
        const { data: b } = await db
          .from("borrowers")
          .select("*")
          .order("created_at", { ascending: true });
        if (b) setBorrowers(b.map(borrowerFromRow));

        const { data: l } = await db
          .from("loans")
          .select(
            "*, collateral_items(item_type, alphanumeric_code), applied_interests(period_end)",
          )
          .order("created_at", { ascending: true });

        const { data: i } = await db
          .from("applied_interests")
          .select("*")
          .order("created_at", { ascending: true });
        if (i) setInterests(i.map(interestFromRow));

        if (l)
          setLoans(
            l.map((row: any) => {
              const ci = Array.isArray(row.collateral_items)
                ? row.collateral_items[0]
                : row.collateral_items;
              // Derive lastPaymentDate from the latest applied_interest period_end, or fall back to start_date
              const aiEntries: any[] = Array.isArray(row.applied_interests)
                ? row.applied_interests
                : [];
              const latestEnd =
                aiEntries.length > 0
                  ? aiEntries
                      .map((a: any) => a.period_end)
                      .sort()
                      .pop()
                  : null;
              return {
                ...loanFromRow(row),
                collateralType: ci?.item_type ?? "",
                collateralCode: ci?.alphanumeric_code ?? "",
                lastPaymentDate: latestEnd ?? row.start_date,
              };
            }),
          );
      };
      fetchData();
    }
  }, [isSupabaseConnected]);

  // Sync to local storage only if NOT using supabase
  useEffect(() => {
    if (!isSupabaseConnected) localStorage.setItem("nk_borrowers", JSON.stringify(borrowers));
  }, [borrowers, isSupabaseConnected]);
  useEffect(() => {
    if (!isSupabaseConnected) localStorage.setItem("nk_loans", JSON.stringify(loans));
  }, [loans, isSupabaseConnected]);
  useEffect(() => {
    if (!isSupabaseConnected) localStorage.setItem("nk_interests", JSON.stringify(interests));
  }, [interests, isSupabaseConnected]);

  // Always sync global config to localstorage
  useEffect(() => {
    if (globalBorrowerId) localStorage.setItem("nk_global_borrower", globalBorrowerId);
    else localStorage.removeItem("nk_global_borrower");
  }, [globalBorrowerId]);

  const addBorrower = async (b: Omit<Borrower, "id" | "createdAt">) => {
    if (isSupabaseConnected && supabase) {
      const row = borrowerToRow(b);
      const { data, error } = await supabase.from("borrowers").insert(row).select().single();
      if (error) {
        console.error("Supabase error", error);
        return;
      }
      setBorrowers((prev) => [...prev, borrowerFromRow(data)]);
    } else {
      const newBorrower = {
        ...b,
        id: `B-${Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, "0")}`,
        createdAt: new Date().toISOString(),
      };
      setBorrowers((prev) => [...prev, newBorrower]);
    }
  };

  const updateBorrower = async (
    id: string,
    updates: Partial<Omit<Borrower, "id" | "createdAt">>,
  ) => {
    if (isSupabaseConnected && supabase) {
      const row = borrowerToRow(updates);
      const { error } = await supabase.from("borrowers").update(row).eq("id", id);
      if (error) {
        console.error("Supabase error", error);
        return;
      }
    }
    setBorrowers((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const addLoan = async (l: Omit<Loan, "id" | "createdAt" | "status" | "lastPaymentDate">) => {
    if (isSupabaseConnected && supabase) {
      const loanRow = {
        borrower_id: l.borrowerId,
        principal_amount: l.principal,
        interest_rate_monthly: l.rate,
        start_date: l.startDate,
        status: "active",
        compound_threshold_months: l.thresholdMonths,
      };
      const { data: loanData, error: lError } = await supabase
        .from("loans")
        .insert(loanRow)
        .select()
        .single();
      if (lError) {
        console.error("Supabase error", lError);
        return;
      }

      if (l.collateralCode) {
        const { error: cError } = await supabase.from("collateral_items").insert({
          loan_id: loanData.id,
          item_type: l.collateralType || "Other",
          alphanumeric_code: l.collateralCode,
        });
        if (cError) {
          console.error("Supabase collateral error", cError);
        }
      }

      const newLoan: Loan = {
        ...loanFromRow(loanData),
        collateralType: l.collateralType,
        collateralCode: l.collateralCode,
        lastPaymentDate: loanData.start_date,
      };
      setLoans((prev) => [...prev, newLoan]);
    } else {
      const newLoan = {
        ...l,
        id: `L-${Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, "0")}`,
        createdAt: new Date().toISOString(),
        status: "active" as const,
        lastPaymentDate: l.startDate,
      };
      setLoans((prev) => [...prev, newLoan]);
    }
  };

  const addInterest = async (i: {
    loanId: string;
    startDate: string;
    endDate: string;
    amount: number;
    newPrincipal: number;
  }) => {
    const loan = loans.find((l) => l.id === i.loanId);
    const previousPrincipal = loan?.principal || i.newPrincipal;

    if (isSupabaseConnected && supabase) {
      const row = {
        loan_id: i.loanId,
        period_start: i.startDate,
        period_end: i.endDate,
        interest_amount: i.amount,
      };
      const { data, error: iError } = await supabase
        .from("applied_interests")
        .insert(row)
        .select()
        .single();
      if (iError) {
        console.error("Supabase error", iError);
        return;
      }

      const { error: lError } = await supabase
        .from("loans")
        .update({ principal_amount: i.newPrincipal })
        .eq("id", i.loanId);
      if (lError) {
        console.error("Supabase error", lError);
        return;
      }

      const newInterest: AppliedInterest = { ...interestFromRow(data), previousPrincipal };
      setInterests((prev) => [...prev, newInterest]);
    } else {
      const newInterest = {
        id: `I-${Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, "0")}`,
        loanId: i.loanId,
        startDate: i.startDate,
        endDate: i.endDate,
        amount: i.amount,
        createdAt: new Date().toISOString(),
        previousPrincipal,
      };
      setInterests((prev) => [...prev, newInterest]);
    }

    setLoans((prev) =>
      prev.map((loan) => {
        if (loan.id === i.loanId) {
          return { ...loan, principal: i.newPrincipal, lastPaymentDate: i.endDate };
        }
        return loan;
      }),
    );
  };

  const deleteInterest = async (id: string) => {
    const iTarg = interests.find((i) => i.id === id);
    if (!iTarg) return;

    if (isSupabaseConnected && supabase) {
      const { error: dError } = await supabase.from("applied_interests").delete().eq("id", id);
      if (dError) {
        console.error("Supabase error", dError);
        return;
      }

      const oldPrin =
        iTarg.previousPrincipal || loans.find((l) => l.id === iTarg.loanId)?.principal;
      const { error: lError } = await supabase
        .from("loans")
        .update({ principal_amount: oldPrin })
        .eq("id", iTarg.loanId);
      if (lError) {
        console.error("Supabase error", lError);
        return;
      }
    }

    setLoans((prev) =>
      prev.map((l) => {
        if (l.id === iTarg.loanId) {
          return {
            ...l,
            lastPaymentDate: iTarg.startDate,
            principal: iTarg.previousPrincipal || l.principal,
          };
        }
        return l;
      }),
    );
    setInterests((prev) => prev.filter((i) => i.id !== id));
  };

  const closeLoan = async (id: string, closedDate: string, note?: string) => {
    if (isSupabaseConnected && supabase) {
      const { error } = await supabase.from("loans").update({ status: "closed" }).eq("id", id);
      if (error) {
        console.error("Supabase error", error);
        return;
      }
    }
    setLoans((prev) =>
      prev.map((l) => {
        if (l.id === id) {
          return { ...l, status: "closed" as const, closedDate, closureNote: note };
        }
        return l;
      }),
    );
  };

  const deleteLoan = async (id: string) => {
    if (isSupabaseConnected && supabase) {
      await supabase.from("applied_interests").delete().eq("loan_id", id);
      await supabase.from("collateral_items").delete().eq("loan_id", id);
      const { error } = await supabase.from("loans").delete().eq("id", id);
      if (error) {
        console.error("Supabase error", error);
        return;
      }
    }
    setInterests((prev) => prev.filter((i) => i.loanId !== id));
    setLoans((prev) => prev.filter((l) => l.id !== id));
  };

  const clearWorkspace = async () => {
    if (isSupabaseConnected && supabase) {
      await supabase
        .from("applied_interests")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase
        .from("collateral_items")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("loans").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("borrowers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    } else {
      localStorage.removeItem("nk_borrowers");
      localStorage.removeItem("nk_loans");
      localStorage.removeItem("nk_interests");
    }
    setBorrowers([]);
    setLoans([]);
    setInterests([]);
  };

  return (
    <MockContext.Provider
      value={{
        borrowers,
        loans,
        interests,
        addBorrower,
        updateBorrower,
        addLoan,
        addInterest,
        deleteInterest,
        closeLoan,
        deleteLoan,
        clearWorkspace,
        globalBorrowerId,
        setGlobalBorrowerId,
        isSupabaseConnected,
      }}
    >
      {children}
    </MockContext.Provider>
  );
}

export function useMockData() {
  const ctx = useContext(MockContext);
  if (!ctx) throw new Error("useMockData must be inside MockProvider");
  return ctx;
}
