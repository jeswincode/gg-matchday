import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

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
    .replace(/^./, (value) => value.toUpperCase())
    .replace(/Messages$/, " messages")
    .replace(/Requests$/, " requests");
}

const copy = {
  healthy: {
    label: "Healthy",
    icon: "✅",
  },
  watch: {
    label: "Watch",
    icon: "🟡",
  },
  action: {
    label: "Action soon",
    icon: "🟠",
  },
  critical: {
    label: "Critical",
    icon: "🔴",
  },
};

export default function DatabaseHealth() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api("/system/database-health")
      .then((result) => {
        if (active) {
          setData(result);
          setError("");
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const collections = useMemo(
    () => Object.entries(data?.collections || {}).sort((a, b) => b[1] - a[1]),
    [data]
  );

  const status = copy[data?.status] || copy.healthy;
  const width = Math.min(100, Math.max(0, data?.usagePercent || 0));

  return (
    <section className="card database-health">
      <div className="section-heading">
        <div>
          <p className="eyebrow">DATABASE</p>
          <h3>Database health</h3>
        </div>
        {!loading && data && (
          <span className={`database-health-status database-health-status-${data.status}`}>
            {status.icon} {status.label}
          </span>
        )}
      </div>

      {loading ? (
        <div className="loading-panel">Reading database health…</div>
      ) : error ? (
        <div className="empty-state">
          <h3>Database health unavailable</h3>
          <p>{error}</p>
        </div>
      ) : (
        <>
          <div className="database-health-meter">
            <div className="database-health-meter-head">
              <div>
                <strong>{formatBytes(data.logicalBytes)}</strong>
                <span>data + indexes</span>
              </div>
              <div className="database-health-meter-total">
                {formatBytes(data.planQuotaBytes)}
                <span>configured quota</span>
              </div>
            </div>
            <div
              className="database-health-track"
              role="progressbar"
              aria-label="Database storage usage"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={data.usagePercent}
            >
              <span style={{ width: `${width}%` }} />
            </div>
            <div className="database-health-meter-foot">
              <span>{data.usagePercent.toFixed(1)}% used</span>
              <span>{formatBytes(Math.max(0, data.planQuotaBytes - data.logicalBytes))} remaining</span>
            </div>
          </div>

          <div className="database-health-stats">
            <div>
              <strong>{formatBytes(data.dataBytes)}</strong>
              <span>BSON data</span>
            </div>
            <div>
              <strong>{formatBytes(data.indexBytes)}</strong>
              <span>Indexes</span>
            </div>
            <div>
              <strong>{formatBytes(data.storageBytes)}</strong>
              <span>Allocated storage</span>
            </div>
          </div>

          <div className="database-health-collections">
            <div className="database-health-collections-head">
              <span>COLLECTION</span>
              <span>DOCUMENTS</span>
            </div>
            {collections.map(([name, count]) => (
              <div key={name}>
                <span>{labelForCollection(name)}</span>
                <strong>{count.toLocaleString()}</strong>
              </div>
            ))}
          </div>

          <p className="muted database-health-note">
            This is an application-level view of MongoDB data + index size. Keep Atlas metrics as the source of truth for cluster quota and billing.
          </p>
        </>
      )}
    </section>
  );
}
