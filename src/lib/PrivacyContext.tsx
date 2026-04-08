import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface PrivacyContextValue {
  masked: boolean;
  toggleMask: () => void;
  m: (value: number, opts?: { decimals?: number; prefix?: string }) => string;
}

const PrivacyContext = createContext<PrivacyContextValue>({
  masked: false,
  toggleMask: () => {},
  m: (v) => `₹${v.toLocaleString("en-IN")}`,
});

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [masked, setMasked] = useState(() => localStorage.getItem("nk_privacy") === "true");

  const toggleMask = () => {
    setMasked((prev) => {
      localStorage.setItem("nk_privacy", String(!prev));
      return !prev;
    });
  };

  const m = useCallback(
    (value: number, opts?: { decimals?: number; prefix?: string }): string => {
      const prefix = opts?.prefix ?? "₹";
      if (masked) return `${prefix}•••••`;
      const formatted = value.toLocaleString("en-IN", {
        maximumFractionDigits: opts?.decimals ?? 0,
      });
      return `${prefix}${formatted}`;
    },
    [masked],
  );

  return (
    <PrivacyContext.Provider value={{ masked, toggleMask, m }}>{children}</PrivacyContext.Provider>
  );
}

export const usePrivacy = () => useContext(PrivacyContext);
