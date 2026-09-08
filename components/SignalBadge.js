import { ArrowUpRight, ArrowDownRight, Minus, Radar } from "lucide-react";

const STYLES = {
  BUY: {
    label: "BUY",
    classes: "bg-bull-500/10 text-bull-400 ring-1 ring-inset ring-bull-500/30",
    Icon: ArrowUpRight,
  },
  SELL: {
    label: "SELL",
    classes: "bg-bear-500/10 text-bear-400 ring-1 ring-inset ring-bear-500/30",
    Icon: ArrowDownRight,
  },
  FORMING: {
    label: "FORMING",
    classes: "bg-amber-500/10 text-amber-400 ring-1 ring-inset ring-amber-500/30",
    Icon: Radar,
  },
  NEUTRAL: {
    label: "NEUTRAL",
    classes: "bg-ink-500/10 text-ink-500 ring-1 ring-inset ring-ink-500/20",
    Icon: Minus,
  },
};

export default function SignalBadge({ signal, size = "md" }) {
  const config = STYLES[signal] || STYLES.NEUTRAL;
  const { Icon } = config;
  const sizeClasses = size === "sm" ? "text-[11px] px-2 py-0.5 gap-1" : "text-xs px-2.5 py-1 gap-1.5";

  return (
    <span
      className={`inline-flex items-center rounded-full font-mono font-semibold tracking-wide ${sizeClasses} ${config.classes}`}
    >
      <Icon size={size === "sm" ? 11 : 13} strokeWidth={2.5} />
      {config.label}
    </span>
  );
}
