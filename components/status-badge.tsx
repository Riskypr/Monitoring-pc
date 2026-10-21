import { Check, Circle, Clock3, Minus } from "lucide-react";

const config = {
  ONLINE: { label: "Online", className: "status-online", Icon: Check },
  OFFLINE: { label: "Offline", className: "status-offline", Icon: Circle },
  NEVER_ONLINE: { label: "Belum online", className: "status-never", Icon: Clock3 },
  INACTIVE: { label: "Nonaktif", className: "status-inactive", Icon: Minus },
} as const;

export function StatusBadge({ status }: { status: keyof typeof config }) {
  const { label, className, Icon } = config[status];
  return <span className={`status-badge ${className}`}><Icon size={12} strokeWidth={2.5} />{label}</span>;
}
