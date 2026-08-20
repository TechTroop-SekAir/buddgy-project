import {
  Wallet,
  ShoppingCart,
  UtensilsCrossed,
  Zap,
  Car,
  Film,
  PiggyBank,
  Home,
  HeartPulse,
  ShoppingBag,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Menu as MenuIcon,
  LayoutDashboard,
  ArrowLeftRight,
  BarChart3,
  RefreshCw,
  MoreHorizontal,
  Pencil,
  Trash2,
  History,
  TrendingUp,
  TrendingDown,
  LogOut,
  Settings,
  Upload,
  X,
  Check,
  AlertTriangle,
  User,
  Sparkles,
  Send,
} from 'lucide-react';

// The only module allowed to import lucide-react — see client/CLAUDE.md
// § Component Boundary and docs/DASHBOARD-REDESIGN.md Step 2. Feature code
// imports Icon from components/ui, never a lucide component directly.
const ICON_REGISTRY = {
  wallet: Wallet,
  shoppingCart: ShoppingCart,
  utensils: UtensilsCrossed,
  zap: Zap,
  car: Car,
  film: Film,
  piggyBank: PiggyBank,
  home: Home,
  heartPulse: HeartPulse,
  bag: ShoppingBag,
  calendarDays: CalendarDays,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  plus: Plus,
  menu: MenuIcon,
  layoutDashboard: LayoutDashboard,
  arrowLeftRight: ArrowLeftRight,
  barChart3: BarChart3,
  refreshCw: RefreshCw,
  moreHorizontal: MoreHorizontal,
  pencil: Pencil,
  trash: Trash2,
  history: History,
  trendingUp: TrendingUp,
  trendingDown: TrendingDown,
  logOut: LogOut,
  settings: Settings,
  upload: Upload,
  x: X,
  check: Check,
  alertTriangle: AlertTriangle,
  user: User,
  sparkles: Sparkles,
  send: Send,
};

const SIZES = { xs: 12, sm: 14, md: 16, lg: 18 };

// Icons that carry inherent left/right meaning (previous/next) and must
// physically mirror under RTL. Everything else — including directional
// glyphs like TrendingUp/TrendingDown, where rising-to-the-right is the
// universal financial convention Hebrew charts also follow — stays as-is.
// See docs/DASHBOARD-REDESIGN.md § RTL Conversion Reference.
const MIRROR_IN_RTL = new Set(['chevronLeft', 'chevronRight']);

/**
 * <Icon name="wallet" size="sm" className="text-cat-1" />
 *
 * Decorative by default (aria-hidden). Pass `title` to make it a meaningful
 * graphic (role="img" + accessible name) instead.
 */
export function Icon({ name, size = 'md', title, className = '', ...props }) {
  const Component = ICON_REGISTRY[name];
  if (!Component) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console -- dev-only guard, not shipped
      console.warn(`Icon: unknown name "${name}", falling back to "wallet"`);
    }
    return (
      <Icon name="wallet" size={size} title={title} className={className} {...props} />
    );
  }

  const pixelSize = typeof size === 'number' ? size : SIZES[size] ?? SIZES.md;
  const rtlClass = MIRROR_IN_RTL.has(name) ? 'rtl:-scale-x-100' : '';

  return (
    <Component
      size={pixelSize}
      className={[className, rtlClass].filter(Boolean).join(' ')}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
      {...props}
    />
  );
}
