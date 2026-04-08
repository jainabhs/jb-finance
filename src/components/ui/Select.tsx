import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

interface SelectProps {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  buttonClassName?: string;
  icon?: React.ReactNode;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  buttonClassName = "",
  icon,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selectedLabel = options.find((o) => o.value === value)?.label || placeholder;

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`relative flex items-center justify-between outline-none transition-all ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 overflow-hidden w-full pr-6">
          {icon && <span className="shrink-0">{icon}</span>}
          <span
            className={`truncate ${value ? "text-slate-900 dark:text-white font-semibold" : "text-slate-400 dark:text-slate-500"}`}
          >
            {selectedLabel}
          </span>
        </div>
        <svg
          className={`absolute right-4 w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform shrink-0 ${isOpen ? "rotate-180 text-sky-600 dark:text-sky-400" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 9l-7 7-7-7"
          ></path>
        </svg>
      </button>

      {isOpen &&
        createPortal(
          <div className="fixed inset-0 z-99999" style={{ pointerEvents: "none" }}>
            <div
              className="absolute inset-0 pointer-events-auto"
              onClick={() => setIsOpen(false)}
            />
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "fixed",
                  top: buttonRef.current
                    ? buttonRef.current.getBoundingClientRect().bottom + 6
                    : coords.top + 6,
                  left: buttonRef.current
                    ? buttonRef.current.getBoundingClientRect().left
                    : coords.left,
                  width: coords.width,
                }}
                className="z-100000 pointer-events-auto bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl shadow-slate-200/80 dark:shadow-slate-950/60 overflow-hidden max-h-60 overflow-y-auto flex flex-col"
              >
                {options.length === 0 ? (
                  <div className="px-4 py-4 text-xs text-slate-400 dark:text-slate-500 text-center">
                    No options available
                  </div>
                ) : (
                  options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm transition-colors ${value === opt.value ? "bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 font-semibold" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-sky-600 dark:hover:text-sky-300"}`}
                    >
                      {opt.label}
                    </button>
                  ))
                )}
              </motion.div>
            </AnimatePresence>
          </div>,
          document.body,
        )}
    </>
  );
}
