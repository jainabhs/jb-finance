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
) {
  let currentPrincipal = initialPrincipal;
  let currentDate = startOfDay(startDate);
  const finalDate = startOfDay(endDate);

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
    let nextMonth = addMonths(currentDate, 1);

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
      const amount = (monthlyAmount / 30) * days;

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
