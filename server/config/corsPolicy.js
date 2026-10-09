const PRODUCTION_ORIGINS = new Set(["https://gg-matchday.vercel.app"]);
const DEVELOPMENT_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);

export function isAllowedCorsOrigin(origin, nodeEnv = process.env.NODE_ENV) {
  if (!origin) return true;
  if (nodeEnv === "production") return PRODUCTION_ORIGINS.has(origin);
  const configured = String(process.env.CORS_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean);
  return PRODUCTION_ORIGINS.has(origin) || DEVELOPMENT_ORIGINS.has(origin) || configured.includes(origin);
}

export function createCorsOptions(nodeEnv = process.env.NODE_ENV) {
  return {
    origin(origin, callback) {
      callback(null, isAllowedCorsOrigin(origin, nodeEnv));
    },
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-E2E-Test-Token", "X-E2E-Test-Role", "X-E2E-Test-Player-Id"],
    maxAge: 86400,
  };
}
