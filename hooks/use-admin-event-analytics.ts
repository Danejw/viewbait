"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getAdminEventsAnalytics,
  getAdminEventsJourneys,
  type EventsRange,
} from "@/lib/services/admin-event-analytics";
import type {
  AdminEventsAnalyticsResponse,
  AdminEventsJourneysResponse,
} from "@/types/analytics";

export function useAdminEventAnalytics(
  range: EventsRange = "30d",
  enabled = true,
  includeSeries = false
) {
  return useQuery({
    queryKey: ["admin", "event-analytics", range, includeSeries],
    queryFn: () => getAdminEventsAnalytics(range, includeSeries),
    enabled,
  });
}

export function useAdminEventJourneys(
  range: EventsRange = "30d",
  sessionsLimit = 100,
  eventsPerSession = 50,
  enabled = false
) {
  return useQuery({
    queryKey: ["admin", "event-journeys", range, sessionsLimit, eventsPerSession],
    queryFn: () =>
      getAdminEventsJourneys(range, sessionsLimit, eventsPerSession),
    enabled,
  });
}

export type { AdminEventsAnalyticsResponse, AdminEventsJourneysResponse };
