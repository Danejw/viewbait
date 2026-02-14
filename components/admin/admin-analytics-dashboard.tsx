"use client";

/**
 * Event-level analytics dashboard (admin only). Shows summary, active users,
 * top pages, all events, feature adoption (generate, checkout, assistant, YouTube),
 * errors, and optional session journeys. Uses GET /api/admin/analytics/events.
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAdminEventAnalytics, useAdminEventJourneys } from "@/hooks/use-admin-event-analytics";

type RangeKey = "7d" | "30d";

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

/** Canonical list of all tracked events in the system. Shown in Analytics so you always see the full picture. */
const KNOWN_EVENTS: Array<{ event_name: string; purpose: string; meaning: string }> = [
  { event_name: "page_view", purpose: "Traffic and navigation", meaning: "User viewed a page (client-side route change)." },
  { event_name: "generate_started", purpose: "Generation funnel", meaning: "User submitted a thumbnail generation (manual generator)." },
  { event_name: "generate_completed", purpose: "Generation funnel", meaning: "At least one thumbnail was created successfully for that submission." },
  { event_name: "generate_failed", purpose: "Generation funnel / errors", meaning: "Generation request failed (all or partial)." },
  { event_name: "thumbnail_download", purpose: "Feature usage", meaning: "User downloaded a thumbnail to their device." },
  { event_name: "thumbnail_edit_started", purpose: "Feature usage", meaning: "User opened the edit/regenerate modal." },
  { event_name: "thumbnail_edit_completed", purpose: "Feature usage", meaning: "Edit/regenerate API succeeded; new thumbnail created." },
  { event_name: "thumbnail_favorited", purpose: "Feature usage", meaning: "User toggled favorite on a thumbnail." },
  { event_name: "checkout_started", purpose: "Checkout funnel", meaning: "User clicked to go to Stripe Checkout." },
  { event_name: "checkout_completed", purpose: "Checkout funnel", meaning: "User returned from Stripe; subscription synced." },
  { event_name: "assistant_message_sent", purpose: "Assistant usage", meaning: "User sent a message in chat or Assistant panel." },
  { event_name: "assistant_response_received", purpose: "Assistant usage", meaning: "Assistant returned a response." },
  { event_name: "youtube_connect_started", purpose: "YouTube integration", meaning: "User started YouTube OAuth." },
  { event_name: "youtube_connect_completed", purpose: "YouTube integration", meaning: "YouTube OAuth completed and integration saved." },
  { event_name: "youtube_connect_failed", purpose: "YouTube integration", meaning: "YouTube OAuth failed or denied." },
  { event_name: "error", purpose: "Reliability and debugging", meaning: "Client-side error caught (boundary or critical path)." },
  { event_name: "sign_in", purpose: "Auth and growth", meaning: "User signed in successfully." },
  { event_name: "sign_up", purpose: "Auth and growth", meaning: "User completed sign-up; account created." },
];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-muted-foreground text-sm font-medium uppercase tracking-wider pt-2 first:pt-0">
      {children}
    </h3>
  );
}

/** Export events as CSV for the current range (admin only). */
function ExportCsvButton({ range }: { range: RangeKey }) {
  const [loading, setLoading] = useState(false);
  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics/events/export?range=${range}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analytics-events-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // no-op
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
      {loading ? "Exporting…" : "Export CSV"}
    </Button>
  );
}

/** Compact row of metrics in one card (label + value per column). */
function CompactMetricRow({
  items,
}: {
  items: Array<{ label: string; value: number | string }>;
}) {
  return (
    <Card className="p-3">
      <div className="grid grid-cols-3 gap-4">
        {items.map(({ label, value }) => (
          <div key={label}>
            <p className="text-muted-foreground text-xs font-medium">{label}</p>
            <p className="text-lg font-semibold tabular-nums mt-0.5">
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function AdminAnalyticsDashboard() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [showChart, setShowChart] = useState(false);
  const { data, isLoading, error, refetch } = useAdminEventAnalytics(range);
  const { data: dataWithSeries } = useAdminEventAnalytics(range, showChart, true);

  if (isLoading && !data) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive text-sm">
            {error instanceof Error ? error.message : "Failed to load event analytics"}
          </p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { allEvents, activeUsers, errors, topPaths, featureAdoption } = data;

  return (
    <div className="space-y-3 m-2">
      <div className="flex flex-wrap items-center gap-2">
        {RANGE_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={range === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => setRange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      <section>
        <SectionHeading>Active users</SectionHeading>
        <div className="mt-1">
          <CompactMetricRow
            items={[
              { label: "Daily active", value: activeUsers?.daily ?? 0 },
              { label: "Weekly active", value: activeUsers?.weekly ?? 0 },
              { label: "Monthly active", value: activeUsers?.monthly ?? 0 },
            ]}
          />
        </div>
      </section>

      {topPaths != null && topPaths.length > 0 && (
        <section>
          <SectionHeading>Top pages (page_view)</SectionHeading>
          <Card className="mt-1">
            <CardContent className="px-3 py-2">
              <ul className="space-y-1 text-sm max-h-[200px] overflow-y-auto hide-scrollbar" role="list">
                {topPaths.map(({ path, count }) => (
                  <li key={path} className="flex justify-between gap-2 py-0.5">
                    <span className="text-muted-foreground truncate font-mono text-xs">{path}</span>
                    <span className="font-medium tabular-nums shrink-0 text-xs">
                      {count.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      <section>
        <SectionHeading>All events in the system</SectionHeading>
        <p className="text-muted-foreground text-xs mt-0.5 mb-1">
          Every tracked event type. Counts are for the selected range; sorted by usage (most at top).
        </p>
        <Card className="mt-1">
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto hide-scrollbar">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background border-b">
                  <tr className="text-muted-foreground text-left">
                    <th className="py-2 px-3 font-medium w-[140px]">Event name</th>
                    <th className="py-2 px-3 font-medium w-[140px]">What it&apos;s for</th>
                    <th className="py-2 px-3 font-medium min-w-[200px]">What it means</th>
                    <th className="py-2 px-3 font-medium text-right tabular-nums w-[80px]">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const countByEvent = new Map<string, number>();
                    for (const e of allEvents ?? []) {
                      countByEvent.set(e.event_name, e.count);
                    }
                    const knownSet = new Set(KNOWN_EVENTS.map((ev) => ev.event_name));
                    const rows = KNOWN_EVENTS.map((ev) => ({
                      ...ev,
                      count: countByEvent.get(ev.event_name) ?? 0,
                    }));
                    for (const e of allEvents ?? []) {
                      if (!knownSet.has(e.event_name)) {
                        rows.push({
                          event_name: e.event_name,
                          purpose: "—",
                          meaning: "Seen in data (not in canonical list).",
                          count: e.count,
                        });
                      }
                    }
                    rows.sort((a, b) => b.count - a.count);
                    return rows.map((row) => (
                      <tr key={row.event_name} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-1.5 px-3 font-mono text-foreground">{row.event_name}</td>
                        <td className="py-1.5 px-3 text-muted-foreground">{row.purpose}</td>
                        <td className="py-1.5 px-3 text-muted-foreground">{row.meaning}</td>
                        <td className="py-1.5 px-3 text-right font-medium tabular-nums">
                          {row.count.toLocaleString()}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {featureAdoption != null && (
        <section>
          <SectionHeading>Feature adoption (generate)</SectionHeading>
          <div className="mt-1">
            <CompactMetricRow
              items={[
                { label: "Generate started", value: featureAdoption.generateStarted ?? 0 },
                { label: "Generate completed", value: featureAdoption.generateCompleted ?? 0 },
                {
                  label: "Drop-off rate",
                  value: `${((featureAdoption.dropOffRate ?? 0) * 100).toFixed(1)}%`,
                },
              ]}
            />
          </div>
        </section>
      )}

      <section>
        <SectionHeading>Errors</SectionHeading>
        <Card className="mt-1 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Error events (range) · {errors?.totalInRange ?? 0} total
          </p>
          {errors?.recent && errors.recent.length > 0 ? (
            <div className="max-h-[180px] overflow-y-auto overflow-x-auto hide-scrollbar">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="pb-1 pr-2 font-medium">Date</th>
                    <th className="pb-1 font-medium">Properties</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.recent.slice(0, 10).map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-1 pr-2 text-muted-foreground whitespace-nowrap">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                      <td className="py-1 font-mono truncate max-w-[280px]">
                        {JSON.stringify(row.properties)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">No error events in range.</p>
          )}
        </Card>
      </section>

      <TimeSeriesSection
        range={range}
        showChart={showChart}
        onToggleChart={() => setShowChart((v) => !v)}
        timeSeries={dataWithSeries?.timeSeries}
      />

      <JourneysSection range={range} />
    </div>
  );
}

/** Events over time: toggle to load and show daily buckets (bar chart). */
function TimeSeriesSection({
  range,
  showChart,
  onToggleChart,
  timeSeries,
}: {
  range: RangeKey;
  showChart: boolean;
  onToggleChart: () => void;
  timeSeries?: Array<{ date: string; events: number; pageViews: number; dau: number }>;
}) {
  const maxEvents = Math.max(1, ...(timeSeries?.map((d) => d.events) ?? [0]));
  return (
    <section>
      <SectionHeading>Events over time</SectionHeading>
      <div className="mt-1 flex flex-col gap-2">
        <Button variant="outline" size="sm" className="w-fit" onClick={onToggleChart}>
          {showChart ? "Hide chart" : "Show chart"}
        </Button>
        {showChart && timeSeries != null && timeSeries.length > 0 && (
          <Card className="p-3">
            <p className="text-muted-foreground text-xs mb-2">Daily events (sample cap 100k)</p>
            <div className="space-y-1 max-h-[240px] overflow-y-auto hide-scrollbar">
              {timeSeries.map((d) => (
                <div key={d.date} className="flex items-center gap-2 text-xs">
                  <span className="w-24 shrink-0 text-muted-foreground">{d.date}</span>
                  <div className="min-w-[80px] flex-1 h-5 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-primary/70 rounded"
                      style={{ width: `${(d.events / maxEvents) * 100}%` }}
                      title={`${d.events} events`}
                    />
                  </div>
                  <span className="w-14 shrink-0 tabular-nums">{d.events}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
        {showChart && timeSeries != null && timeSeries.length === 0 && (
          <p className="text-muted-foreground text-xs">No data in range.</p>
        )}
      </div>
    </section>
  );
}

/** Optional Journeys section: toggle to load and show session journeys. */
function JourneysSection({ range }: { range: RangeKey }) {
  const [showJourneys, setShowJourneys] = useState(false);
  const { data: journeys, isLoading, error } = useAdminEventJourneys(
    range,
    100,
    50,
    showJourneys
  );

  return (
    <section>
      <SectionHeading>Session journeys</SectionHeading>
      <div className="mt-1 flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => setShowJourneys((v) => !v)}
        >
          {showJourneys ? "Hide journeys" : "View journeys"}
        </Button>
        {showJourneys && (
          <>
            {isLoading && (
              <Skeleton className="h-24 w-full" />
            )}
            {error && (
              <p className="text-destructive text-xs">{error instanceof Error ? error.message : "Failed to load journeys"}</p>
            )}
            {journeys?.sessions != null && journeys.sessions.length > 0 && (
              <Card className="p-3">
                <ul className="space-y-2 max-h-[320px] overflow-y-auto hide-scrollbar">
                  {journeys.sessions.map((s) => (
                    <li key={s.session_id} className="border-b last:border-0 pb-2 last:pb-0 text-xs">
                      <p className="font-mono text-muted-foreground truncate">
                        {s.session_id.slice(0, 12)}… {s.user_id ? `· user ${s.user_id.slice(0, 8)}…` : "· anon"}
                      </p>
                      <ul className="mt-1 space-y-0.5 pl-2">
                        {s.events.slice(-15).map((ev, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-muted-foreground shrink-0">
                              {new Date(ev.created_at).toLocaleTimeString()}
                            </span>
                            <span className="font-mono truncate">{ev.event_name}</span>
                            {ev.page_path && (
                              <span className="truncate text-muted-foreground">{ev.page_path}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {showJourneys && !isLoading && !error && journeys?.sessions != null && journeys.sessions.length === 0 && (
              <p className="text-muted-foreground text-xs">No sessions in range.</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
