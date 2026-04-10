import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  Users,
  Calculator,
  IndianRupee,
  UserSquare2,
  Moon,
  Sun,
  History,
  LogOut,
  ChevronDown,
  Eye,
  EyeOff,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMockData } from "../lib/MockContext";
import { useTheme } from "../lib/ThemeContext";
import { useAuth } from "../lib/AuthContext";
import { cn } from "../lib/utils";
import { Toaster } from "react-hot-toast";
import { usePrivacy } from "../lib/PrivacyContext";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, short: "Home" },
  { name: "Borrowers", href: "/borrowers", icon: Users, short: "Borr" },
  { name: "Loans", href: "/loans", icon: Wallet, short: "Loan" },
  { name: "Interest", href: "/interest", icon: Calculator, short: "Calc" },
  { name: "History", href: "/history", icon: History, short: "Hist" },
];

export function Layout() {
  const { borrowers, globalBorrowerId, setGlobalBorrowerId, isMockMode, toggleMockMode } = useMockData();
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { masked, toggleMask } = usePrivacy();
  const [borrowerOpen, setBorrowerOpen] = useState(false);

  const activeBorrower = borrowers.find((b) => b.id === globalBorrowerId);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors duration-200">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Mobile/Tablet: Row 1 — branding left, controls right */}
          <div className="flex lg:hidden h-12 items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-400 to-yellow-600 shadow-sm shadow-amber-500/20">
                <IndianRupee className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-black tracking-tight text-slate-900 dark:text-white">
                JB Finance
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleMask}
                className={cn(
                  "w-8 h-8 shrink-0 flex items-center justify-center rounded-lg border transition-all",
                  masked
                    ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400",
                )}
                title={masked ? "Show amounts" : "Hide amounts"}
              >
                {masked ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={toggleTheme}
                className="h-8 shrink-0 flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5 w-16 relative transition-all"
              >
                {/* Inactive icon on the track */}
                {theme === "light" ? (
                  <Moon className="absolute right-2.5 w-3 h-3 text-sky-400" />
                ) : (
                  <Sun className="absolute left-2.5 w-3 h-3 text-amber-400" />
                )}
                {/* Knob with active icon */}
                <motion.div
                  className="w-7 h-7 rounded-full bg-white dark:bg-slate-600 shadow-sm relative z-10 shrink-0 flex items-center justify-center"
                  animate={{ x: theme === "light" ? 0 : 28 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  {theme === "light" ? (
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 text-sky-400" />
                  )}
                </motion.div>
              </button>
              {isMockMode ? (
                <button
                  onClick={toggleMockMode}
                  className="h-8 shrink-0 flex items-center gap-1.5 rounded-lg border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20 px-2.5 text-violet-600 dark:text-violet-400 text-[11px] font-semibold"
                  title="Exit mock mode"
                >
                  <LogOut className="w-3.5 h-3.5" /> Mock
                </button>
              ) : user && (
                <button
                  onClick={signOut}
                  className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400"
                  title={user.email || "Sign out"}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Mobile/Tablet: Row 2 — borrower selector full width */}
          <div className="lg:hidden border-t border-slate-100 dark:border-slate-800/40">
            <div className="relative py-2">
              <button
                onClick={() => setBorrowerOpen(!borrowerOpen)}
                className="flex w-full items-center gap-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-600/50 rounded-lg px-3 py-2 transition-all"
              >
                <UserSquare2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                  {activeBorrower?.fullName || "All Borrowers"}
                </span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 ml-auto transition-transform",
                    borrowerOpen && "rotate-180",
                  )}
                />
              </button>
              <AnimatePresence>
                {borrowerOpen && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-40"
                      onClick={() => setBorrowerOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.12 }}
                      className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl shadow-slate-200/60 dark:shadow-slate-950/60 overflow-hidden max-h-64 overflow-y-auto"
                    >
                      <button
                        onClick={() => { setGlobalBorrowerId(null); setBorrowerOpen(false); }}
                        className={cn(
                          "w-full text-left px-4 py-2.5 text-xs transition-colors",
                          !globalBorrowerId
                            ? "bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold"
                            : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50",
                        )}
                      >
                        All Borrowers
                      </button>
                      {borrowers.length > 0 && <div className="h-px bg-slate-100 dark:bg-slate-700/50" />}
                      {borrowers.map((b) => (
                        <button
                          key={b.id}
                          onClick={() => { setGlobalBorrowerId(b.id); setBorrowerOpen(false); }}
                          className={cn(
                            "w-full text-left px-4 py-2.5 text-xs transition-colors",
                            globalBorrowerId === b.id
                              ? "bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold"
                              : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50",
                          )}
                        >
                          {b.fullName}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Desktop: single row */}
          <div className="hidden lg:flex h-14 items-center gap-2">
            {/* Desktop Logo */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-400 to-yellow-600 shadow-md shadow-amber-500/20">
                <IndianRupee className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                JB Finance
              </span>
            </div>

            {/* Desktop nav */}
            <nav className="flex items-center gap-0.5 flex-1 justify-center">
              {navigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    cn(
                      "relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all",
                      isActive
                        ? "text-sky-700 dark:text-sky-300 font-semibold"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isActive
                            ? "text-sky-600 dark:text-sky-400"
                            : "text-slate-400 dark:text-slate-500",
                        )}
                      />
                      {item.name}
                      {isActive && (
                        <motion.div
                          layoutId="topnav-indicator"
                          className="absolute -bottom-[11px] left-3 right-3 h-0.5 bg-sky-500 rounded-full"
                        />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* Desktop controls */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleMask}
                className={cn(
                  "w-8 h-8 shrink-0 flex items-center justify-center rounded-lg border transition-all",
                  masked
                    ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700",
                )}
                title={masked ? "Show amounts" : "Hide amounts"}
              >
                {masked ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={toggleTheme}
                className="h-8 shrink-0 flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5 w-16 relative transition-all"
              >
                {/* Inactive icon on the track */}
                {theme === "light" ? (
                  <Moon className="absolute right-2.5 w-3 h-3 text-sky-400" />
                ) : (
                  <Sun className="absolute left-2.5 w-3 h-3 text-amber-400" />
                )}
                {/* Knob with active icon */}
                <motion.div
                  className="w-7 h-7 rounded-full bg-white dark:bg-slate-600 shadow-sm relative z-10 shrink-0 flex items-center justify-center"
                  animate={{ x: theme === "light" ? 0 : 28 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  {theme === "light" ? (
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 text-sky-400" />
                  )}
                </motion.div>
              </button>

              {isMockMode ? (
                <button
                  onClick={toggleMockMode}
                  className="h-8 shrink-0 flex items-center gap-1.5 rounded-lg border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20 px-2.5 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-all text-[11px] font-semibold"
                  title="Exit mock mode"
                >
                  <LogOut className="w-3.5 h-3.5" /> Mock
                </button>
              ) : user && (
                <button
                  onClick={signOut}
                  className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/15 transition-all text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400"
                  title={user.email || "Sign out"}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Desktop borrower selector */}
              <div className="relative">
                <button
                  onClick={() => setBorrowerOpen(!borrowerOpen)}
                  className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-600/50 rounded-lg px-3 py-2 transition-all max-w-[200px]"
                >
                  <UserSquare2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                    {activeBorrower?.fullName || "All Borrowers"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 ml-auto transition-transform",
                      borrowerOpen && "rotate-180",
                    )}
                  />
                </button>
                <AnimatePresence>
                  {borrowerOpen && (
                    <>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40"
                        onClick={() => setBorrowerOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        className="absolute top-full right-0 mt-1.5 z-50 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl shadow-slate-200/60 dark:shadow-slate-950/60 overflow-hidden max-h-64 overflow-y-auto"
                      >
                        <button
                          onClick={() => {
                            setGlobalBorrowerId(null);
                            setBorrowerOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-4 py-2.5 text-xs transition-colors",
                            !globalBorrowerId
                              ? "bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold"
                              : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50",
                          )}
                        >
                          All Borrowers
                        </button>
                        {borrowers.length > 0 && (
                          <div className="h-px bg-slate-100 dark:bg-slate-700/50" />
                        )}
                        {borrowers.map((b) => (
                          <button
                            key={b.id}
                            onClick={() => {
                              setGlobalBorrowerId(b.id);
                              setBorrowerOpen(false);
                            }}
                            className={cn(
                              "w-full text-left px-4 py-2.5 text-xs transition-colors",
                              globalBorrowerId === b.id
                                ? "bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold"
                                : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50",
                            )}
                          >
                            {b.fullName}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Main ─── */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-28 lg:pb-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        >
          <Outlet />
        </motion.div>
      </main>

      {/* ─── Mobile Dock — Apple Liquid Glass ─── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+6px)] pointer-events-none">
        <nav className="dock-glass flex items-center justify-around py-1.5 px-1 rounded-[18px] pointer-events-auto">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center justify-center w-13 h-10 rounded-xl transition-all",
                  isActive
                    ? "text-sky-500 dark:text-sky-400"
                    : "text-slate-400 dark:text-slate-500 active:scale-90",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="dock-pill"
                      className="absolute inset-0 rounded-xl bg-sky-500/10 dark:bg-sky-400/10"
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                    />
                  )}
                  <item.icon
                    className={cn("w-[21px] h-[21px] relative z-10", isActive && "scale-110")}
                  />
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <Toaster
        position="top-center"
        toastOptions={{
          className:
            "!bg-white dark:!bg-slate-800 !text-slate-900 dark:!text-slate-100 !border !border-slate-200 dark:!border-slate-700 !shadow-lg !text-sm !rounded-xl",
          duration: 2500,
          style: { marginTop: "4px" },
        }}
      />
    </div>
  );
}
