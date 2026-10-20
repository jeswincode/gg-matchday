import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import "./database-health.css";

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`;
}

function labelForCollection(name) {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, value => value.toUpperCase())
    .replace(/Messages$/, " messages")
    .replace(/Requests$/, " requests");
}

function formatTime(value) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Not recorded" : parsed.toLocaleString();
}

function formatAge(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return "Not observed";
  const value = Math.max(0, Number(seconds));
  if (value < 60) return `${Math.floor(value)}s ago`;
  if (value < 3600) return `${Math.floor(value / 60)}m ago`;
  if (value < 86400) return `${Math.floor(value / 3600)}h ago`;
  return `${Math.floor(value / 86400)}d ago`;
}

function formatUptime(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return "Not reported";
  const value = Math.max(0, Math.floor(Number(seconds)));
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${value}s`;
}

function formatDuration(value) {
  return value == null || !Number.isFinite(Number(value)) ? "—" : `${Math.round(Number(value))} ms`;
}

const databaseStatusCopy = {
  healthy: { label: "Below reference threshold", icon: "✓" },
  watch: { label: "Watch", icon: "!" },
  action: { label: "Action soon", icon: "!" },
  critical: { label: "Critical", icon: "!" },
};

const providerStatusCopy = {
  unobserved: { label: "Not observed", icon: "·" },
  "not-configured": { label: "Not configured", icon: "—" },
  degraded: { label: "Last attempt failed", icon: "!" },
  "last-call-success": { label: "Last attempt succeeded", icon: "✓" },
};

const databaseLinkStatus = {
  connected: "Connected",
  unreachable: "Unreachable",
  disconnected: "Disconnected",
  "not-configured": "Not configured",
};

export default function DatabaseHealth() {
  const [data, setData] = useState(null);
  const [operationsHealth, setOperationsHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [operationsError, setOperationsError] = useState("");
  const requestController = useRef(null);

  const refresh = useCallback(async ({ manual = false } = {}) => {
    if (manual) setRefreshing(true);
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;

    try {
      const [databaseResult, operationsResult] = await Promise.allSettled([
        api("/system/database-health", { signal: controller.signal }),
        api("/system/operations-health", { signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;

      if (databaseResult.status === "fulfilled") {
        setData(databaseResult.value);
        setError("");
      } else {
        setError(databaseResult.reason?.message || "Could not refresh database health.");
      }

      if (operationsResult.status === "fulfilled") {
        setOperationsHealth(operationsResult.value);
        setOperationsError("");
      } else {
        setOperationsError(operationsResult.reason?.message || "Could not refresh provider observations.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    // The refresh completes asynchronously; loading state is updated by its promise handlers.
    refresh().catch(() => {});
    const interval = setInterval(() => refresh().catch(() => {}), 60_000);
    return () => {
      clearInterval(interval);
      requestController.current?.abort();
    };
  }, [refresh]);

  const collections = useMemo(
    () => Object.entries(data?.collections || {}).sort((a, b) => b[1] - a[1]),
    [data],
  );

  const status = databaseStatusCopy[data?.status] || null;
  const usagePercent = Number.isFinite(Number(data?.usagePercent)) ? Number(data.usagePercent) : 0;
  const width = Math.min(100, Math.max(0, usagePercent));
  const providers = operationsHealth?.providers || [];
  const providerGroups = useMemo(() => providers.reduce((groups, provider) => {
    const key = provider.group || "Other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(provider);
    return groups;
  }, {}), [providers]);

  return (
    <div className="database-health-workspace">
      <section className="card database-health">
        <div className="section-heading">
          <div>
            <p className="eyebrow">DATABASE</p>
            <h3>Database health</h3>
            {data?.generatedAt && <p className="database-health-updated">Last successful reading: {formatTime(data.generatedAt)}</p>}
          </div>
          <div className="database-health-heading-actions">
            {!loading && data && status && (
              <span className={`database-health-status database-health-status-${data.status}`}>
                {status.icon} {status.label}
              </span>
            )}
            <button type="button" className="secondary-button database-health-refresh" onClick={() => refresh({ manual: true })} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {loading && !data ? (
          <div className="loading-panel">Reading database health…</div>
        ) : error && !data ? (
          <div className="empty-state" role="alert">
            <h3>Database health unavailable</h3>
            <p>{error}</p>
            <button type="button" className="secondary-button" onClick={() => refresh({ manual: true })} disabled={refreshing}>Retry</button>
          </div>
        ) : data ? (
          <>
            {error && <p className="database-health-warning" role="status">Refresh failed; showing the last successful reading. {error}</p>}
            <div className="database-health-meter">
              <div className="database-health-meter-head">
                <div>
                  <strong>{formatBytes(data.logicalBytes)}</strong>
                  <span>data + indexes</span>
                </div>
                <div className="database-health-meter-total">
                  {formatBytes(data.quotaReferenceBytes ?? data.planQuotaBytes)}
                  <span>application reference threshold</span>
                </div>
              </div>
              <div
                className="database-health-track"
                role="progressbar"
                aria-label="Database logical size versus application reference threshold"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={width}
              >
                <span style={{ width: `${width}%` }} />
              </div>
              <div className="database-health-meter-foot">
                <span>{usagePercent.toFixed(1)}% of reference</span>
                <span>{formatBytes(Math.max(0, (data.quotaReferenceBytes ?? data.planQuotaBytes) - data.logicalBytes))} below threshold</span>
              </div>
            </div>

            <div className="database-health-stats">
              <div><strong>{formatBytes(data.dataBytes)}</strong><span>BSON data</span></div>
              <div><strong>{formatBytes(data.indexBytes)}</strong><span>Indexes</span></div>
              <div><strong>{formatBytes(data.storageBytes)}</strong><span>Allocated storage</span></div>
            </div>

            <div className="database-health-collections">
              <div className="database-health-collections-head">
                <span>COLLECTION</span><span>ESTIMATED DOCUMENTS</span>
              </div>
              {collections.map(([name, count]) => (
                <div key={name}>
                  <span>{labelForCollection(name)}</span>
                  <strong>{Number(count).toLocaleString()}</strong>
                </div>
              ))}
            </div>

            <p className="muted database-health-note">
              {data.quotaReferenceNote || "This is an application-level size reference, not an authoritative cluster quota or billing metric."}
              {" "}Collection counts use MongoDB estimatedDocumentCount and may not be transactionally exact.
            </p>
          </>
        ) : null}
      </section>

      <section className="card database-operations-health">
        <div className="section-heading">
          <div>
            <p className="eyebrow">RUNTIME OBSERVATIONS</p>
            <h3>Database connections & providers</h3>
            <p className="muted">Live database pings plus the last outcomes observed during normal app requests.</p>
          </div>
          <div className="database-health-heading-actions">
            {operationsHealth && (
              <span className={`database-health-status database-health-status-${operationsHealth.status === "degraded" ? "critical" : "healthy"}`}>
                {operationsHealth.status === "degraded" ? "Database degraded" : "Database pings OK"}
              </span>
            )}
            {operationsHealth?.generatedAt && <span className="database-health-updated">Checked {formatTime(operationsHealth.generatedAt)}</span>}
          </div>
        </div>

        {operationsError && !operationsHealth && (
          <div className="empty-state" role="alert"><h3>Operational diagnostics unavailable</h3><p>{operationsError}</p></div>
        )}
        {operationsError && operationsHealth && (
          <p className="database-health-warning" role="status">The latest diagnostics refresh failed; showing the last successful observation. {operationsError}</p>
        )}

        {operationsHealth && (
          <>
            <div className="database-health-runtime-meta">
              <span>API process started: {formatTime(operationsHealth.runtime?.startedAt)}</span>
              <span>Uptime: {formatUptime(operationsHealth.runtime?.uptimeSeconds)}</span>
              <span>{operationsHealth.runtime?.nodeVersion || "Node version not reported"}</span>
            </div>

            <div className="database-health-databases">
              {[
                ["Core Matchday database", operationsHealth.databases?.core],
                ["Clubs database", operationsHealth.databases?.clubs],
              ].map(([label, database]) => {
                const state = database?.status || "disconnected";
                return (
                  <article className="database-health-provider" data-status={state} key={label}>
                    <div className="database-health-provider-head">
                      <h4>{label}</h4><span className={"database-health-provider-status status-" + state}>{databaseLinkStatus[state] || state}</span>
                    </div>
                    <div className="database-health-provider-meta">
                      <span>Ping latency: {formatDuration(database?.latencyMs)}</span>
                      {!database?.configured && <span>Optional integration is not configured</span>}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="database-health-provider-groups">
              {Object.entries(providerGroups).map(([group, groupProviders]) => (
                <section key={group} className="database-health-provider-group">
                  <div className="database-health-provider-group-heading"><h4>{group}</h4><span>{groupProviders.length} observed sources</span></div>
                  <div className="database-health-provider-grid">
                    {groupProviders.map(provider => {
                      const statusCopy = providerStatusCopy[provider.status] || providerStatusCopy.unobserved;
                      return (
                        <article className="database-health-provider" data-status={provider.status} key={provider.key}>
                          <div className="database-health-provider-head">
                            <h5>{provider.label}</h5>
                            <span className={"database-health-provider-status status-" + provider.status}>{statusCopy.icon} {statusCopy.label}</span>
                          </div>
                          <p className="database-health-provider-note">{provider.note}</p>
                          <p className="database-health-provider-config">Configuration: {provider.configuredBy}</p>
                          <dl>
                            <div><dt>Last attempt</dt><dd>{provider.lastProviderOutcome === "not-configured" ? "Not attempted" : formatTime(provider.lastAttemptAt)}</dd></div>
                            <div><dt>Last success</dt><dd>{formatTime(provider.lastSuccessAt)}</dd></div>
                            <div><dt>Last observed</dt><dd>{formatAge(provider.lastObservedAgeSeconds)}</dd></div>
                            <div><dt>Last duration</dt><dd>{formatDuration(provider.lastDurationMs)}</dd></div>
                          </dl>
                          <div className="database-health-provider-counts">
                            <span>{provider.successes || 0} successes</span>
                            <span>{provider.failures || 0} failures</span>
                            <span>{provider.fallbacksUsed || 0} fallbacks</span>
                            <span>{provider.cacheHits || 0} cache hits</span>
                          </div>
                          {provider.lastReasonCode && <small className="database-health-reason">Reason: {provider.lastReasonCode}</small>}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            <p className="muted database-health-note">
              {operationsHealth.providerObservationsNote} No external-provider probes are run by this screen. “Last attempt succeeded” means the last observed call succeeded, not that a provider is continuously available. Backup/restore status is not monitored by this runtime endpoint.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
