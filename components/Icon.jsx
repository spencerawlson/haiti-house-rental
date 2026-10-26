import {
  ArrowLeftRight, Ban, Banknote, Bath, BedDouble, Bell, CalendarDays, Camera, Car, CircleCheck,
  CirclePause, CircleX, ClipboardList, Coins, CreditCard, Download, Droplet, Eye, Flag, Footprints,
  Globe, Handshake, Heart, Hourglass, House, KeyRound, LogOut, Map as MapIcon, MapPin, Megaphone,
  MessageCircle, Moon, OctagonX, PenLine, Receipt, Repeat, Ruler, Search, Settings, Shield, Sofa, Sparkles,
  Sprout, Star, Sun, SunMoon, Tag, Timer, Trash2, TrendingUp, TriangleAlert, Undo2, User, Users,
  Wifi, Zap,
} from 'lucide-react';

// Vector icons for the whole app (Lucide, ISC licence). They replaced
// emoji, which every phone draws differently — and older Android phones,
// common in Haiti, sometimes as empty boxes. These look the same
// everywhere, stay sharp at any size, follow the text colour (so dark
// mode just works) and are hidden from screen readers: the words next to
// them carry the meaning. Size follows the font size (1em) unless given.
const ICONS = {
  area: Ruler,
  ban: Ban,
  bath: Bath,
  bed: BedDouble,
  bell: Bell,
  calendar: CalendarDays,
  camera: Camera,
  car: Car,
  card: CreditCard,
  chart: TrendingUp,
  chat: MessageCircle,
  check: CircleCheck,
  download: Download,
  exchange: Coins,
  eye: Eye,
  flag: Flag,
  footprints: Footprints,
  globe: Globe,
  heart: Heart,
  home: House,
  hourglass: Hourglass,
  key: KeyRound,
  live: null, // a filled green dot, drawn below
  map: MapIcon,
  megaphone: Megaphone,
  money: Banknote,
  moon: Moon,
  overview: ClipboardList,
  partner: Handshake,
  pause: CirclePause,
  pin: MapPin,
  power: Zap,
  receipt: Receipt,
  repeat: Repeat,
  returning: Undo2,
  search: Search,
  settings: Settings,
  shield: Shield,
  signout: LogOut,
  signup: PenLine,
  sofa: Sofa,
  sparkles: Sparkles,
  sprout: Sprout,
  star: Star,
  stop: OctagonX,
  sun: Sun,
  swap: ArrowLeftRight,
  tag: Tag,
  theme: SunMoon,
  timer: Timer,
  trash: Trash2,
  user: User,
  users: Users,
  warning: TriangleAlert,
  water: Droplet,
  wifi: Wifi,
  x: CircleX,
};

export const ICON_NAMES = Object.keys(ICONS);

export default function Icon({ name, size = '1em', filled = false, className = '', style, strokeWidth = 2 }) {
  if (name === 'live') {
    return <span className={`icon icon-live ${className}`} style={style} aria-hidden="true" />;
  }
  const Svg = ICONS[name];
  if (!Svg) return null;
  return (
    <Svg
      className={`icon ${className}`}
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      fill={filled ? 'currentColor' : 'none'}
      style={style}
      aria-hidden="true"
      focusable="false"
    />
  );
}
