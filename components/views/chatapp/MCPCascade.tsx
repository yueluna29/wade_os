import React from 'react';
import {
  MapPin,
  ScanEye,
  Activity,
  Camera,
  Phone,
  Calendar,
  Music,
  Smartphone,
  Clock,
  Mic,
  Battery,
  Wifi,
  type LucideIcon,
} from 'lucide-react';

/**
 * MCP icon registry.
 *
 * To add a new icon type:
 *   1. Import the lucide icon above
 *   2. Add `keyName: IconComponent` here
 *   3. That's it — type safety + UI both update automatically
 */
export const MCP_ICONS = {
  pulse: Activity,
  location: MapPin,
  eye: ScanEye,
  camera: Camera,
  phone: Phone,
  calendar: Calendar,
  music: Music,
  app: Smartphone,
  time: Clock,
  mic: Mic,
  battery: Battery,
  wifi: Wifi,
} as const satisfies Record<string, LucideIcon>;

export type McpIconKey = keyof typeof MCP_ICONS;

export interface McpLog {
  icon: McpIconKey;
  text: string;
}

interface MCPCascadeProps {
  logs: McpLog[] | undefined;
  isSelf: boolean;
}

export const MCPCascade: React.FC<MCPCascadeProps> = ({ logs, isSelf }) => {
  if (!logs || logs.length === 0) return null;

  return (
    <div
      className={`relative z-10 flex flex-col gap-1.5 mb-3 ${
        isSelf ? 'items-end pr-2' : 'items-start pl-2'
      }`}
    >
      {/* Subtle vertical timeline line — only when we have multiple entries */}
      {logs.length > 1 && (
        <div
          className={`absolute top-2 bottom-2 w-[1.5px] rounded-full ${
            isSelf
              ? 'right-0 bg-gradient-to-b from-wade-accent/30 via-wade-accent/10 to-transparent'
              : 'left-0 bg-gradient-to-b from-wade-text-muted/20 via-wade-text-muted/5 to-transparent'
          }`}
        />
      )}

      {logs.map((log, idx) => {
        const Icon = MCP_ICONS[log.icon] ?? Activity;
        return (
          <div
            key={idx}
            className={`flex items-start gap-2 opacity-60 ${
              isSelf ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <div
              className={`mt-[3px] bg-wade-bg-card/60 rounded-full p-0.5 shadow-sm ${
                isSelf ? 'text-wade-accent' : 'text-wade-text-muted'
              }`}
            >
              <Icon size={9} strokeWidth={2.5} />
            </div>
            <span
              className={`text-[10.5px] font-medium tracking-wide leading-snug ${
                isSelf ? 'text-wade-accent' : 'text-wade-text-muted'
              }`}
            >
              {log.text}
            </span>
          </div>
        );
      })}
    </div>
  );
};
