"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { CalendarClock, Clock, UserRound } from "lucide-react";
import type { CreateServiceRequestState } from "../actions";
import type { RequestProviderTarget } from "../db";
import {
  formatAvailabilityTime,
  getProviderAvailabilityBlocks,
} from "../availability.js";
import {
  requestDurationOptions,
  requestUrgencyOptions,
} from "../validation.js";
import { ServiceInfoTooltip } from "../../provider/service-label";

type RequestServiceFormProps = {
  action: (
    previousState: CreateServiceRequestState,
    formData: FormData,
  ) => Promise<CreateServiceRequestState>;
  contactEmail: string;
  contactName: string;
  initialService: string;
  initialZip: string;
  nowIso: string;
  provider: RequestProviderTarget;
  today: string;
};

type AvailabilityBlock = {
  disabled: boolean;
  endMinutes: number;
  endTime: string;
  startMinutes: number;
  startTime: string;
  type: "available" | "booked";
};

type AvailabilityWindow = {
  blocks: AvailabilityBlock[];
  endMinutes: number;
  endTime: string;
  startMinutes: number;
  startTime: string;
};

type AvailabilityCalendar = {
  dayLabel: string;
  windows: AvailabilityWindow[];
};

function FieldError({ className = "", message }: { className?: string; message?: string }) {
  return message ? (
    <span className={`field-error${className ? ` ${className}` : ""}`} role="alert">
      {message}
    </span>
  ) : null;
}

function getStateValue(
  state: CreateServiceRequestState,
  key: string,
  fallback: string,
) {
  return state.values[key] || fallback;
}

export function RequestServiceForm({
  action,
  contactEmail,
  contactName,
  initialService,
  initialZip,
  nowIso,
  provider,
  today,
}: RequestServiceFormProps) {
  const [state, formAction, isPending] = useActionState(action, {
    message: "",
    fieldErrors: {},
    values: {},
  });
  const [requestedDate, setRequestedDate] = useState(() =>
    getStateValue(state, "requestedDate", today),
  );
  const [durationMinutes, setDurationMinutes] = useState(() =>
    getStateValue(state, "durationMinutes", "60"),
  );
  const [windowStartTime, setWindowStartTime] = useState(() =>
    getStateValue(state, "windowStartTime", "09:00"),
  );
  const [windowEndTime, setWindowEndTime] = useState(() =>
    getStateValue(state, "windowEndTime", "12:00"),
  );
  const serviceOptions = provider.services.length ? provider.services : [];
  const availability = useMemo<AvailabilityCalendar>(
    () =>
      getProviderAvailabilityBlocks({
        availabilityWindows: provider.availabilityWindows,
        bookings: provider.bookings,
        requestedDate,
        durationMinutes: Number.parseInt(durationMinutes, 10),
        now: new Date(nowIso),
        timeZone: provider.availabilityTimezone,
        minimumNoticeMinutes: provider.minimumNoticeMinutes,
      }) as AvailabilityCalendar,
    [durationMinutes, nowIso, provider, requestedDate],
  );

  useEffect(() => {
    if (state.values.requestedDate) setRequestedDate(state.values.requestedDate);
    if (state.values.durationMinutes) setDurationMinutes(state.values.durationMinutes);
    if (state.values.windowStartTime) setWindowStartTime(state.values.windowStartTime);
    if (state.values.windowEndTime) setWindowEndTime(state.values.windowEndTime);
  }, [state.values]);

  function selectAvailabilitySlot(startTime: string, endTime: string) {
    setWindowStartTime(startTime);
    setWindowEndTime(endTime);
  }

  return (
    <form className="form-card provider-profile-form request-form" action={formAction}>
      {state.message ? (
        <p className="form-alert error full" role="alert">
          {state.message}
        </p>
      ) : null}

      <input name="providerProfileId" type="hidden" value={provider.id} />
      <input name="matchPreference" type="hidden" value="specific" />

      <section className="request-context full" aria-label="Selected provider">
        <UserRound size={19} />
        <span>Requesting {provider.displayName || "this provider"}.</span>
      </section>
      <FieldError className="full" message={state.fieldErrors.providerProfileId} />

      <label>
        <span className="field-label-row">
          Service needed
          {serviceOptions.some((option) => option.serviceType === "medical_companion") ? (
            <ServiceInfoTooltip label="Medical Companion" serviceType="medical_companion" />
          ) : null}
        </span>
        <select
          name="serviceType"
          defaultValue={getStateValue(state, "serviceType", initialService)}
          required
        >
          <option value="">Select a service</option>
          {serviceOptions.map((option) => (
            <option key={option.serviceType} value={option.serviceType}>
              {option.label}
            </option>
          ))}
        </select>
        <FieldError message={state.fieldErrors.serviceType} />
      </label>

      <label>
        ZIP code
        <input
          name="zipCode"
          type="text"
          placeholder="94107"
          defaultValue={getStateValue(state, "zipCode", initialZip)}
          inputMode="numeric"
          autoComplete="postal-code"
          required
        />
        <FieldError message={state.fieldErrors.zipCode} />
      </label>

      <label>
        Requested date
        <input
          name="requestedDate"
          type="date"
          min={today}
          value={requestedDate}
          onChange={(event) => setRequestedDate(event.target.value)}
          required
        />
        <FieldError message={state.fieldErrors.requestedDate} />
      </label>

      <label>
        Duration
        <select
          name="durationMinutes"
          value={durationMinutes}
          onChange={(event) => setDurationMinutes(event.target.value)}
          required
        >
          {requestDurationOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <FieldError message={state.fieldErrors.durationMinutes} />
      </label>

      <section className="request-availability-calendar full" aria-label="Provider availability calendar">
        <header>
          <div>
            <span>Provider availability</span>
            <strong>
              {availability.dayLabel} · {requestedDate}
            </strong>
          </div>
          <div className="request-calendar-legend" aria-label="Availability legend">
            <span className="legend-available">Available</span>
            <span className="legend-booked">Booked</span>
            <span className="legend-short">Too short</span>
          </div>
        </header>

        {availability.windows.length ? (
          <div className="request-calendar-windows">
            {availability.windows.map((window) => {
              const windowMinutes = window.endMinutes - window.startMinutes;

              return (
                <article className="request-calendar-window" key={`${window.startTime}-${window.endTime}`}>
                  <div className="request-calendar-window-label">
                    <Clock size={15} />
                    <span>
                      {formatAvailabilityTime(window.startTime)} - {formatAvailabilityTime(window.endTime)}
                    </span>
                  </div>
                  <div className="request-calendar-track">
                    {window.blocks.length ? (
                      window.blocks.map((block) => {
                        const offset = ((block.startMinutes - window.startMinutes) / windowMinutes) * 100;
                        const width = ((block.endMinutes - block.startMinutes) / windowMinutes) * 100;
                        const label =
                          block.type === "booked"
                            ? "Booked"
                            : block.disabled
                              ? "Too short"
                              : "Available";
                        const style = {
                          left: `${offset}%`,
                          width: `${width}%`,
                        };

                        return block.type === "available" ? (
                          <button
                            className={`request-calendar-block available${block.disabled ? " disabled" : ""}`}
                            disabled={block.disabled}
                            key={`${block.type}-${block.startTime}-${block.endTime}`}
                            onClick={() => selectAvailabilitySlot(block.startTime, block.endTime)}
                            style={style}
                            type="button"
                          >
                            <span>{label}</span>
                            <small>
                              {formatAvailabilityTime(block.startTime)} - {formatAvailabilityTime(block.endTime)}
                            </small>
                          </button>
                        ) : (
                          <span
                            className="request-calendar-block booked"
                            aria-label={`Booked ${formatAvailabilityTime(block.startTime)} to ${formatAvailabilityTime(block.endTime)}`}
                            key={`${block.type}-${block.startTime}-${block.endTime}`}
                            style={style}
                          >
                            <span>{label}</span>
                            <small>
                              {formatAvailabilityTime(block.startTime)} - {formatAvailabilityTime(block.endTime)}
                            </small>
                          </span>
                        );
                      })
                    ) : (
                      <span className="request-calendar-empty-block">No future availability in this window</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="request-calendar-empty">
            No scheduled availability for this date. Choose another date from the provider's weekly schedule.
          </p>
        )}

        {provider.onDemandAvailable ? (
          <p className="request-calendar-note">
            On-demand requests are accepted during available windows with {provider.minimumNoticeMinutes} minutes notice.
          </p>
        ) : null}
      </section>

      <label>
        Earliest start
        <input
          name="windowStartTime"
          type="time"
          value={windowStartTime}
          onChange={(event) => setWindowStartTime(event.target.value)}
          required
        />
      </label>

      <label>
        Latest end
        <input
          name="windowEndTime"
          type="time"
          value={windowEndTime}
          onChange={(event) => setWindowEndTime(event.target.value)}
          required
        />
        <FieldError message={state.fieldErrors.timeWindow} />
      </label>

      <fieldset className="radio-group full">
        <legend>Urgency</legend>
        {requestUrgencyOptions.map((option) => (
          <label key={option.value}>
            <input
              name="urgency"
              type="radio"
              value={option.value}
              defaultChecked={getStateValue(state, "urgency", "soon") === option.value}
            />
            <span>{option.label}</span>
          </label>
        ))}
        <FieldError message={state.fieldErrors.urgency} />
      </fieldset>

      <label>
        Contact name
        <input
          name="contactName"
          type="text"
          defaultValue={getStateValue(state, "contactName", contactName)}
          autoComplete="name"
          required
        />
        <FieldError message={state.fieldErrors.contactName} />
      </label>

      <label>
        Contact email
        <input
          name="contactEmail"
          type="email"
          defaultValue={getStateValue(state, "contactEmail", contactEmail)}
          autoComplete="email"
          required
        />
        <FieldError message={state.fieldErrors.contactEmail} />
      </label>

      <label className="full">
        Contact phone
        <input
          name="contactPhone"
          type="tel"
          placeholder="(555) 123-4567"
          defaultValue={getStateValue(state, "contactPhone", "")}
          autoComplete="tel"
          required
        />
        <FieldError message={state.fieldErrors.contactPhone} />
      </label>

      <label className="full">
        Notes
        <textarea
          name="notes"
          placeholder="Share details about the task, preferences, accessibility needs, or anything the provider should know."
          defaultValue={getStateValue(state, "notes", "")}
          rows={5}
        />
        <FieldError message={state.fieldErrors.notes} />
      </label>

      <section className="request-context full" aria-label="Request summary note">
        <CalendarClock size={19} />
        <span>Submitting this sends the request only if this provider is available for the selected time.</span>
      </section>

      <FieldError className="full" message={state.fieldErrors.form} />

      <button className="button button-primary form-button full" type="submit" disabled={isPending}>
        {isPending ? "Submitting request" : "Submit request"}
      </button>
    </form>
  );
}
