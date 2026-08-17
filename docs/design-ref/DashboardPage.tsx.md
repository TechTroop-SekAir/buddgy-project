import { useState, useRef, useEffect } from 'react'
import {
  Wallet,
  Sparkles,
  ChevronDown,
  Plus,
  Bell,
  User,
  LayoutDashboard,
  ArrowLeftRight,
  CalendarDays,
  BarChart3,
  ShoppingCart,
  UtensilsCrossed,
  Zap,
  Car,
  Film,
  PiggyBank,
  RefreshCw,
  Send,
  MoreHorizontal,
  Pencil,
  History,
  TrendingUp,
  TrendingDown,
  Sun,
  Moon,
  LogOut,
  Settings,
  Upload,
  X,
  Check,
} from 'lucide-react'

// ─── Formatters ────────────────────────────────────────────────────────────────
const fmt = (agorot: number) =>
  '₪' + (agorot / 100).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const pct = (spent: number, budget: number) =>
  budget === 0 ? 0 : Math.min(100, Math.round((spent / budget) * 100))

// ─── Mock Data ─────────────────────────────────────────────────────────────────
const ENVELOPES = [
  { id: 1, name: 'Groceries',      icon: ShoppingCart,    color: '#38bdf8', bg: '#f0f9ff', monthly_budget_agorot: 250000, spent_agorot: 167300 },
  { id: 2, name: 'Dining Out',     icon: UtensilsCrossed, color: '#f57373', bg: '#fff5f5', monthly_budget_agorot: 120000, spent_agorot: 108500 },
  { id: 3, name: 'Utilities',      icon: Zap,             color: '#a78bfa', bg: '#faf5ff', monthly_budget_agorot: 80000,  spent_agorot: 61200  },
  { id: 4, name: 'Transportation', icon: Car,             color: '#34d399', bg: '#f0fdf4', monthly_budget_agorot: 90000,  spent_agorot: 24800  },
  { id: 5, name: 'Entertainment',  icon: Film,            color: '#fb923c', bg: '#fff7ed', monthly_budget_agorot: 60000,  spent_agorot: 57100  },
  { id: 6, name: 'Savings',        icon: PiggyBank,       color: '#22d3ee', bg: '#ecfeff', monthly_budget_agorot: 150000, spent_agorot: 150000 },
]

const TRANSACTIONS = [
  { id: 1, envelope_id: 1, amount_agorot: 18400, description: 'Rami Levi Supermarket',    source: 'csv',      transaction_date: '2026-08-17' },
  { id: 2, envelope_id: 2, amount_agorot: 8700,  description: 'Café Yotvata',              source: 'manual',   transaction_date: '2026-08-17' },
  { id: 3, envelope_id: 3, amount_agorot: 32000, description: 'Electric bill August',      source: 'calendar', transaction_date: '2026-08-16' },
  { id: 4, envelope_id: 4, amount_agorot: 5400,  description: 'Rav Kav top-up',            source: 'manual',   transaction_date: '2026-08-16' },
  { id: 5, envelope_id: 5, amount_agorot: 5500,  description: 'Netflix subscription',      source: 'csv',      transaction_date: '2026-08-15' },
  { id: 6, envelope_id: 1, amount_agorot: 23100, description: 'Shufersal Online delivery', source: 'csv',      transaction_date: '2026-08-14' },
  { id: 7, envelope_id: 2, amount_agorot: 14200, description: 'Abu Hassan, Jaffa',         source: 'manual',   transaction_date: '2026-08-13' },
]

const CALENDAR_EVENTS = [
  { id: 'e1', title: 'Car Insurance Renewal',   start_date: '2026-08-22', estimated_cost_agorot: 84000, target_envelope_id: 4, status: 'synced'  as const },
  { id: 'e2', title: "Matan's Birthday Dinner", start_date: '2026-08-24', estimated_cost_agorot: 32000, target_envelope_id: 2, status: 'synced'  as const },
  { id: 'e3', title: 'Electricity Bill Due',    start_date: '2026-08-29', estimated_cost_agorot: 48000, target_envelope_id: 3, status: 'pending' as const },
  { id: 'e4', title: 'Gym Membership',          start_date: '2026-09-01', estimated_cost_agorot: 22000, target_envelope_id: 5, status: 'synced'  as const },
]

const MONTHS = [
  'January 2026','February 2026','March 2026','April 2026',
  'May 2026','June 2026','July 2026','August 2026',
  'September 2026','October 2026','November 2026','December 2026',
]

const AI_CHIPS = [
  "Can I afford dining out tonight?",
  "Log ₪45 for coffee",
  "How much left in Groceries?",
]

// ─── Helpers ───────────────────────────────────────────────────────────────────
function envelopeById(id: number) { return ENVELOPES.find(e => e.id === id) }

function progressColor(p: number): string {
  if (p >= 100) return '#f57373'
  if (p >= 90)  return '#fb923c'
  if (p >= 75)  return '#facc15'
  return '#34d399'
}

function dayLabel(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Bar({ spent, budget }: { spent: number; budget: number }) {
  const p = pct(spent, budget)
  const color = progressColor(p)
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${p}%`, backgroundColor: color }}
      />
    </div>
  )
}

function EnvelopeCard({ env }: { env: typeof ENVELOPES[0] }) {
  const [menu, setMenu] = useState(false)
  const p = pct(env.spent_agorot, env.monthly_budget_agorot)
  const remaining = env.monthly_budget_agorot - env.spent_agorot
  const overspent = remaining < 0
  const Icon = env.icon
  const statusColor = progressColor(p)

  return (
    <div className="group relative bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: env.bg }}>
            <Icon size={16} style={{ color: env.color }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{env.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">{fmt(env.monthly_budget_agorot)} budget</p>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setMenu(v => !v)}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-slate-50 text-slate-400 transition-all"
          >
            <MoreHorizontal size={14} />
          </button>
          {menu && (
            <div className="absolute right-0 top-8 z-20 w-40 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5">
              {[{ label: 'Edit', icon: Pencil }, { label: 'Add Expense', icon: Plus }, { label: 'History', icon: History }].map(({ label, icon: I }) => (
                <button key={label} onClick={() => setMenu(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                  <I size={12} className="text-slate-400" />{label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-xs text-slate-400 mb-1">Spent</p>
          <p className="text-xl font-bold text-slate-900 font-mono leading-none">{fmt(env.spent_agorot)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400 mb-1">{overspent ? 'Over by' : 'Left'}</p>
          <p className="text-sm font-semibold leading-none" style={{ color: statusColor }}>
            {overspent ? fmt(Math.abs(remaining)) : fmt(remaining)}
          </p>
        </div>
      </div>

      <Bar spent={env.spent_agorot} budget={env.monthly_budget_agorot} />

      <div className="flex items-center justify-between mt-2.5">
        <span className="text-[11px] text-slate-400 font-mono">{p}%</span>
        {p >= 90 && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ color: statusColor, backgroundColor: statusColor + '18' }}>
            {overspent ? 'Over budget' : 'Near limit'}
          </span>
        )}
      </div>
    </div>
  )
}

function CalendarRow({ ev }: { ev: typeof CALENDAR_EVENTS[0] }) {
  const env = envelopeById(ev.target_envelope_id!)
  const Icon = env?.icon ?? CalendarDays
  const date = new Date(ev.start_date)
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="w-10 h-10 rounded-xl bg-slate-50 flex flex-col items-center justify-center flex-shrink-0 border border-slate-100">
        <span className="text-[9px] font-semibold text-slate-400 uppercase leading-none">
          {date.toLocaleDateString('en', { month: 'short' })}
        </span>
        <span className="text-sm font-bold text-slate-800 leading-tight">{date.getDate()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{ev.title}</p>
        {env && (
          <div className="flex items-center gap-1 mt-0.5">
            <Icon size={10} style={{ color: env.color }} />
            <span className="text-[11px] text-slate-400">{env.name}</span>
          </div>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        {ev.estimated_cost_agorot && (
          <p className="text-sm font-semibold text-slate-800 font-mono">{fmt(ev.estimated_cost_agorot)}</p>
        )}
        <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium mt-0.5 px-1.5 py-0.5 rounded-full ${
          ev.status === 'synced'
            ? 'bg-emerald-50 text-emerald-600'
            : 'bg-amber-50 text-amber-600'
        }`}>
          {ev.status === 'synced' ? <Check size={9} /> : null}
          {ev.status}
        </span>
      </div>
    </div>
  )
}

function TxRow({ tx }: { tx: typeof TRANSACTIONS[0] }) {
  const env = envelopeById(tx.envelope_id)
  const Icon = env?.icon ?? ArrowLeftRight
  const sourceStyle: Record<string, string> = {
    manual:   'bg-violet-50 text-violet-500',
    csv:      'bg-sky-50 text-sky-500',
    calendar: 'bg-emerald-50 text-emerald-500',
  }
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: env?.bg ?? '#f8fafc' }}>
        <Icon size={13} style={{ color: env?.color ?? '#94a3b8' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 truncate">{tx.description}</p>
        <p className="text-[11px] text-slate-400">{dayLabel(tx.transaction_date)}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${sourceStyle[tx.source]}`}>{tx.source}</span>
        <span className="text-sm font-semibold text-slate-800 font-mono">-{fmt(tx.amount_agorot)}</span>
      </div>
    </div>
  )
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [month, setMonth] = useState('August 2026')
  const [monthOpen, setMonthOpen] = useState(false)
  const [nav, setNav] = useState('Dashboard')
  const [profileOpen, setProfileOpen] = useState(false)
  const [dark, setDark] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const [aiOpen, setAiOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const totalBudget  = ENVELOPES.reduce((s, e) => s + e.monthly_budget_agorot, 0)
  const totalSpent   = ENVELOPES.reduce((s, e) => s + e.spent_agorot, 0)
  const totalRemain  = totalBudget - totalSpent
  const overallPct   = pct(totalSpent, totalBudget)
  const overallColor = progressColor(overallPct)

  const sendAi = () => {
    const text = aiInput.trim()
    if (!text) return
    setAiMessages(m => [...m, { role: 'user', text }])
    setAiInput('')
    setTimeout(() => {
      setAiMessages(m => [...m, {
        role: 'ai',
        text: 'Your Dining Out envelope is at 90% — keeping tonight under ₪120 keeps you on track for the month.',
      }])
    }, 700)
  }

  const NAV = [
    { label: 'Dashboard',        icon: LayoutDashboard },
    { label: 'Transactions',     icon: ArrowLeftRight   },
    { label: 'Planned Expenses', icon: CalendarDays     },
    { label: 'Analytics',        icon: BarChart3        },
  ]

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40">
        {/* Accent stripe */}
        <div className="h-0.5 w-full" style={{
          background: 'linear-gradient(90deg, #f57373 0%, #fb923c 30%, #38bdf8 70%, #7dd3fc 100%)'
        }} />

        <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f57373, #38bdf8)' }}>
              <Wallet size={14} className="text-white" />
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900">Buddgy</span>
          </div>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
            {NAV.map(({ label, icon: Icon }) => (
              <button key={label} onClick={() => setNav(label)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                  nav === label
                    ? 'bg-slate-100 text-slate-900 font-medium'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}>
                <Icon size={13} />
                {label}
              </button>
            ))}
          </nav>

          {/* Controls */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Dark mode */}
            <button onClick={() => setDark(d => !d)}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Month picker */}
            <div className="relative">
              <button onClick={() => setMonthOpen(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:border-slate-300 transition-colors">
                <CalendarDays size={13} className="text-slate-400" />
                <span className="font-medium">{month}</span>
                <ChevronDown size={12} className="text-slate-400" />
              </button>
              {monthOpen && (
                <div className="absolute right-0 top-10 z-50 w-44 bg-white border border-slate-200 rounded-xl shadow-xl py-1 max-h-56 overflow-y-auto">
                  {MONTHS.map(m => (
                    <button key={m} onClick={() => { setMonth(m); setMonthOpen(false) }}
                      className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                        m === month ? 'bg-sky-50 text-sky-600 font-medium' : 'text-slate-600 hover:bg-slate-50'
                      }`}>
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Add button */}
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #f57373, #38bdf8)' }}>
              <Plus size={14} />
              <span>Add</span>
            </button>

            {/* Bell */}
            <button className="relative p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
              <Bell size={15} />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#f57373]" />
            </button>

            {/* Avatar */}
            <div className="relative">
              <button onClick={() => setProfileOpen(v => !v)}
                className="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shadow-sm"
                style={{ background: 'linear-gradient(135deg, #38bdf8, #7dd3fc)' }}>
                D
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-9 z-50 w-52 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5">
                  <div className="px-3 pb-2.5 pt-1.5 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-800">Darya Abbassov</p>
                    <p className="text-xs text-slate-400 mt-0.5">darya@buddgy.app</p>
                  </div>
                  {[
                    { label: 'Profile Settings', icon: Settings },
                    { label: 'Import CSV',        icon: Upload   },
                    { label: 'Sign Out',          icon: LogOut   },
                  ].map(({ label, icon: I }) => (
                    <button key={label} onClick={() => setProfileOpen(false)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                        label === 'Sign Out'
                          ? 'text-rose-500 hover:bg-rose-50'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}>
                      <I size={13} className={label === 'Sign Out' ? 'text-rose-400' : 'text-slate-400'} />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Page body ──────────────────────────────────────────────────────── */}
      <main className="max-w-screen-xl mx-auto px-6 py-8 pb-28">

        {/* Page title */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Overview</h1>
            <p className="text-sm text-slate-400 mt-0.5">{month} · 17 days remaining</p>
          </div>
        </div>

        {/* ── Summary strip ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
          {[
            { label: 'Monthly Budget', value: fmt(totalBudget), icon: TrendingUp,   accent: '#38bdf8', bg: '#f0f9ff' },
            { label: 'Total Spent',    value: fmt(totalSpent),  icon: TrendingDown, accent: '#f57373', bg: '#fff5f5' },
            { label: 'Safe to Spend',  value: fmt(totalRemain), icon: PiggyBank,    accent: '#34d399', bg: '#f0fdf4' },
          ].map(({ label, value, icon: Icon, accent, bg }) => (
            <div key={label} className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}>
                <Icon size={18} style={{ color: accent }} />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">{label}</p>
                <p className="text-xl font-bold text-slate-900 font-mono mt-0.5">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Overall progress */}
        <div className="bg-white border border-slate-200/70 rounded-2xl px-6 py-4 shadow-sm mb-7">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Overall spending — {month}</span>
            <span className="text-sm font-semibold font-mono" style={{ color: overallColor }}>{overallPct}% used</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${overallPct}%`, backgroundColor: overallColor }} />
          </div>
          <p className="text-xs text-slate-400 mt-2">{fmt(totalRemain)} remaining of {fmt(totalBudget)}</p>
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Envelopes — 2 cols */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-800">Envelopes</h2>
              <button className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors">
                <Plus size={12} /> New
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ENVELOPES.map(env => <EnvelopeCard key={env.id} env={env} />)}
            </div>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-5">

            {/* Upcoming events */}
            <div className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CalendarDays size={14} style={{ color: '#38bdf8' }} />
                  <h3 className="text-sm font-semibold text-slate-800">Upcoming</h3>
                </div>
                <button onClick={() => { setSyncing(true); setTimeout(() => setSyncing(false), 1400) }}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors">
                  <RefreshCw size={11} className={syncing ? 'animate-spin text-sky-400' : ''} />
                  Sync
                </button>
              </div>
              {CALENDAR_EVENTS.map(ev => <CalendarRow key={ev.id} ev={ev} />)}
            </div>

            {/* Recent transactions */}
            <div className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight size={14} style={{ color: '#a78bfa' }} />
                  <h3 className="text-sm font-semibold text-slate-800">Recent</h3>
                </div>
                <button className="text-xs text-slate-400 hover:text-slate-600 transition-colors">View all</button>
              </div>
              {TRANSACTIONS.map(tx => <TxRow key={tx.id} tx={tx} />)}
            </div>
          </div>
        </div>
      </main>

      {/* ── Floating AI bar ────────────────────────────────────────────────── */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4">
        <div className="bg-white/90 backdrop-blur-md shadow-xl border border-slate-200/80 rounded-2xl overflow-hidden">

          {/* Chat thread */}
          {aiOpen && aiMessages.length > 0 && (
            <div className="px-4 pt-4 pb-2 flex flex-col gap-2 max-h-44 overflow-y-auto border-b border-slate-100">
              {aiMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] text-sm px-3 py-2 rounded-xl leading-snug ${
                    m.role === 'user'
                      ? 'text-white rounded-br-sm'
                      : 'bg-slate-100 text-slate-700 rounded-bl-sm'
                  }`} style={m.role === 'user' ? { background: 'linear-gradient(135deg, #f57373, #fb923c)' } : {}}>
                    {m.role === 'ai' && (
                      <p className="text-[10px] font-semibold text-sky-500 mb-1 flex items-center gap-1">
                        <Sparkles size={9} /> Buddgy AI
                      </p>
                    )}
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick chips */}
          {!aiOpen && (
            <div className="flex items-center gap-2 px-4 pt-3 pb-1">
              {AI_CHIPS.map(c => (
                <button key={c} onClick={() => { setAiInput(c); setAiOpen(true); inputRef.current?.focus() }}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 hover:bg-sky-50 hover:text-sky-600 transition-colors whitespace-nowrap max-w-[170px] truncate">
                  {c}
                </button>
              ))}
            </div>
          )}

          {/* Input row */}
          <div className="flex items-center gap-2 px-4 py-3">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #f57373, #38bdf8)' }}>
              <Sparkles size={11} className="text-white" />
            </div>
            <input
              ref={inputRef}
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              onFocus={() => setAiOpen(true)}
              onKeyDown={e => e.key === 'Enter' && sendAi()}
              placeholder='Ask Buddgy AI — "Can I afford dining out tonight?"'
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
            />
            {aiOpen && (
              <button onClick={() => { setAiOpen(false); setAiMessages([]); setAiInput('') }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X size={13} />
              </button>
            )}
            <button onClick={sendAi} disabled={!aiInput.trim()}
              className="flex-shrink-0 p-2 rounded-xl text-white disabled:opacity-30 transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #f57373, #38bdf8)' }}>
              <Send size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
