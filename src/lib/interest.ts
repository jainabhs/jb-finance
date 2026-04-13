import { differenceInMonths, differenceInDays, addMonths, startOfDay } from "date-fns";

export function calculateBaseInterest(
  principal: number,
  monthlyRatePct: number,
  startDate: Date,
  endDate: Date,
) {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);

  if (end <= start) return 0;

  const months = differenceInMonths(end, start);
  const dateAfterMonths = addMonths(start, months);
  const remainderDays = differenceInDays(end, dateAfterMonths);

  const monthlyInterest = principal * (monthlyRatePct / 100);
  const remainderInterest = (monthlyInterest / 30) * remainderDays;

  return months * monthlyInterest + remainderInterest;
}

export function calculateCompoundInterest(
  initialPrincipal: number,
  monthlyRatePct: number,
  startDate: Date,
  endDate: Date,
  thresholdMonths: number = 12,
  isFirstInterest: boolean = false,
) {
  let currentPrincipal = initialPrincipal;
  let currentDate = startOfDay(startDate);
  const finalDate = startOfDay(endDate);
  const originDate = new Date(currentDate); // preserve original start for addMonths anchoring

  if (finalDate <= currentDate) {
    return {
      totalInterest: 0,
      finalPrincipal: currentPrincipal,
      totalDue: currentPrincipal,
      periods: [],
    };
  }

  let totalInterest = 0;
  const periods = [];

  let monthsAccumulated = 0;
  let accruedUncapitalizedInterest = 0;

  while (currentDate < finalDate) {
    // Anchor to original start date so Feb doesn't permanently shift all subsequent periods
    let nextMonth = addMonths(originDate, monthsAccumulated + 1);

    // Check if we hit the compounding threshold (e.g. 12 months unpaid)
    if (monthsAccumulated > 0 && monthsAccumulated % thresholdMonths === 0) {
      currentPrincipal += accruedUncapitalizedInterest;
      accruedUncapitalizedInterest = 0;
    }

    if (nextMonth <= finalDate) {
      // Full month iteration
      const amount = currentPrincipal * (monthlyRatePct / 100);
      accruedUncapitalizedInterest += amount;
      totalInterest += amount;

      periods.push({
        label: `1 Month`,
        startDate: new Date(currentDate),
        endDate: new Date(nextMonth),
        principalAtTime: currentPrincipal,
        amount,
      });

      currentDate = nextMonth;
      monthsAccumulated += 1;
    } else {
      // Partial days remaining
      const days = differenceInDays(finalDate, currentDate);
      const monthlyAmount = currentPrincipal * (monthlyRatePct / 100);
      // First month rule: half month if ≤15 days, full month if >15 days (only for loan's very first interest)
      const amount =
        monthsAccumulated === 0 && isFirstInterest
          ? days <= 15
            ? monthlyAmount / 2
            : monthlyAmount
          : (monthlyAmount / 30) * days;

      accruedUncapitalizedInterest += amount;
      totalInterest += amount;

      periods.push({
        label: `${days} Days`,
        startDate: new Date(currentDate),
        endDate: new Date(finalDate),
        principalAtTime: currentPrincipal,
        amount,
      });

      currentDate = finalDate;
    }
  }

  return {
    totalInterest,
    finalPrincipal: currentPrincipal,
    totalDue: currentPrincipal + accruedUncapitalizedInterest,
    periods,
  };
}
