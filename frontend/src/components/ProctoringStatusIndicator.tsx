import { FC } from 'react';
import { Activity, AlertTriangle, ShieldCheck } from 'lucide-react';

type ProctorStatus = 'normal' | 'warning' | 'suspicious';

interface ProctoringStatusIndicatorProps {
  status: ProctorStatus;
}

export const ProctoringStatusIndicator: FC<ProctoringStatusIndicatorProps> = ({ status }) => {
  const config =
    status === 'normal'
      ? {
          label: 'Proctoring Status: Normal',
          shortLabel: 'Normal',
          className: 'bg-green-50 text-green-700 border-green-200',
          Icon: ShieldCheck,
        }
      : status === 'warning'
      ? {
          label: 'Proctoring Status: Warning',
          shortLabel: 'Warning',
          className: 'bg-yellow-50 text-yellow-800 border-yellow-200',
          Icon: AlertTriangle,
        }
      : {
          label: 'Proctoring Status: Suspicious',
          shortLabel: 'Suspicious',
          className: 'bg-red-50 text-red-700 border-red-200',
          Icon: Activity,
        };

  const { label, shortLabel, className, Icon } = config;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium shadow-xs ${className}`}
      role="status"
      aria-label={label}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span>{shortLabel}</span>
    </div>
  );
};

