import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Shorten UUIDs or long IDs for display. L-1234 stays as-is, UUIDs become first 8 chars. */
export function shortId(id: string): string {
  if (id.length <= 10) return id;
  return id.slice(0, 8).toUpperCase();
}
