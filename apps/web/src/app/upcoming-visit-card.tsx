"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck2, CalendarDays, CheckCircle2, Clock, UserRound } from "lucide-react";
import { ServiceLabel } from "./provider/service-label";
import type { UpcomingVisitRecord } from "./requests/db";

const MAX_REFRESH_DELAY_MS = 2_147_483_647;

type UpcomingVisitCardProps = {
  visit: UpcomingVisitRecord | null;
};

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatTime(value: string) {
  const [hourInput, minute] = value.split(":");
  const hour = Number.parseInt(hourInput, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${suffix}`;
}

export function UpcomingVisitCard({ visit }: UpcomingVisitCardProps) {
  const router = useRouter();

  useEffect(() => {
    if (!visit?.endsAt) return;

    const delay = new Date(visit.endsAt).getTime() - Date.now() + 1000;

    if (delay <= 0) {
      router.refresh();
      return;
    }

    const timeout = window.setTimeout(
      () => router.refresh(),
      Math.min(delay, MAX_REFRESH_DELAY_MS),
    );

    return () => window.clearTimeout(timeout);
  }, [router, visit?.endsAt]);

  return (
    <aside className="visit-card" aria-label="Upcoming visit details">
      <h2>
        <CalendarDays size={22} /> Upcoming visit
      </h2>

      {visit ? (
        <>
          <p>
            <CalendarCheck2 size={16} /> {formatDate(visit.bookingDate)}
          </p>
          <p>
            <Clock size={16} /> {formatTime(visit.startTime)} - {formatTime(visit.endTime)}
          </p>
          <p>
            <UserRound size={16} /> {visit.role === "requester" ? "Provider" : "Requester"}:{" "}
            {visit.participantName}
          </p>
          <strong>
            <CheckCircle2 size={16} />{" "}
            <ServiceLabel label={visit.serviceLabel} serviceType={visit.serviceType} suffix="confirmed" />
          </strong>
        </>
      ) : (
        <>
          <p>
            <CalendarCheck2 size={16} /> No upcoming appointments
          </p>
          <p>
            <Clock size={16} /> Confirmed visits will appear here.
          </p>
          <p>
            <UserRound size={16} /> Book or accept a request to schedule a visit.
          </p>
          <strong className="visit-card-empty-status">
            <CalendarDays size={16} /> Nothing scheduled
          </strong>
        </>
      )}
    </aside>
  );
}
