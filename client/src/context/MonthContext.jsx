import { createContext, useContext, useMemo, useState } from 'react';
import { getCurrentMonth } from '../utils/month';
import { shiftMonth } from '../utils/date';

// The single shared "active month selector" (docs/STATE.md § Strategy) — all
// pages read/write the same month here instead of each keeping its own local
// state, so navigating on one page keeps the others in sync when visited.
const MonthContext = createContext(null);

export function MonthProvider({ children }) {
  const [month, setMonth] = useState(getCurrentMonth());

  const goToPreviousMonth = () => setMonth((current) => shiftMonth(current, -1));
  const goToNextMonth = () => setMonth((current) => shiftMonth(current, 1));
  const goToCurrentMonth = () => setMonth(getCurrentMonth());

  const value = useMemo(
    () => ({ month, goToPreviousMonth, goToNextMonth, goToCurrentMonth }),
    [month]
  );

  return <MonthContext.Provider value={value}>{children}</MonthContext.Provider>;
}

export function useMonth() {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error('useMonth must be used within MonthProvider');
  return ctx;
}
