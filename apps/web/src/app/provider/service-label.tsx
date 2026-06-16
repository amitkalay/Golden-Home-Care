import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { getProviderServiceOption } from "./services.js";

type ServiceLabelProps = {
  className?: string;
  label?: string | null;
  serviceType?: string | null;
  showSuggested?: boolean;
  suffix?: ReactNode;
  tooltipFocusable?: boolean;
};

type ServiceInfoTooltipProps = {
  focusable?: boolean;
  label?: string | null;
  serviceType?: string | null;
};

export function ServiceInfoTooltip({ focusable = true, label, serviceType }: ServiceInfoTooltipProps) {
  const option = serviceType ? getProviderServiceOption(serviceType) : null;
  const description = option?.description;
  const displayLabel = label ?? option?.label ?? serviceType ?? "service";

  if (!description) return null;

  return (
    <span className="service-tooltip">
      <span
        aria-label={`${displayLabel}: ${description}`}
        className="service-tooltip-trigger"
        role="img"
        tabIndex={focusable ? 0 : undefined}
      >
        <Info aria-hidden="true" focusable="false" size={14} strokeWidth={2.2} />
      </span>
      <span className="service-tooltip-panel" role="tooltip">
        {description}
      </span>
    </span>
  );
}

export function ServiceLabel({
  className = "",
  label,
  serviceType,
  showSuggested = false,
  suffix,
  tooltipFocusable = true,
}: ServiceLabelProps) {
  const option = serviceType ? getProviderServiceOption(serviceType) : null;
  const displayLabel = label ?? option?.label ?? serviceType ?? "Service";

  return (
    <span className={`service-label${className ? ` ${className}` : ""}`}>
      <span className="service-label-text">{displayLabel}</span>
      {showSuggested && option?.suggested ? <span className="service-suggested-badge">Suggested</span> : null}
      <ServiceInfoTooltip focusable={tooltipFocusable} label={displayLabel} serviceType={serviceType} />
      {suffix}
    </span>
  );
}
