import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { IndianRupee, Mail, Lock, LogIn, UserPlus, Loader2 } from "lucide-react";
import { useAuth } from "../lib/AuthContext";

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    if (mode === "login") {
      const err = await signIn(email, password);
      if (err) setError(err);
    } else {
      const err = await signUp(email, password);
      if (err) setError(err);
      else {
        setSuccess("Account created! You can now sign in.");
        setMode("login");
      }
    }
    setSubmitting(false);
  };

  const inputCls =
    "block w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl py-3.5 pl-11 pr-4 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/30 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-5">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-400 to-yellow-600 shadow-lg shadow-amber-500/20 mb-3">
            <IndianRupee className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            JB Finance
          </h1>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {mode === "login" ? "Sign in to continue" : "Create your account"}
          </p>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/50 rounded-2xl p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls}
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/40 rounded-xl px-3 py-2.5"
              >
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800/40 rounded-xl px-3 py-2.5"
              >
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  {success}
                </p>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="tech-button-primary w-full py-3 text-sm uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === "login" ? (
                <LogIn className="w-4 h-4" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {mode === "login" ? "Sign In" : "Sign Up"}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700/50 text-center">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {mode === "login" ? "No account?" : "Already registered?"}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setError(null);
                  setSuccess(null);
                }}
                className="ml-1.5 text-sky-600 dark:text-sky-400 font-bold"
              >
                {mode === "login" ? "Sign Up" : "Sign In"}
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
