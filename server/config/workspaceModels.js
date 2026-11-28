import { AsyncLocalStorage } from "node:async_hooks";
import mongoose from "mongoose";

const workspace = new AsyncLocalStorage();
const connections = new WeakMap();
const prefix = id => `community_${id}_`;

export function workspaceId() {
  return workspace.getStore() || null;
}

export function inWorkspace(id, operation) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("Invalid community storage namespace.");
  return workspace.run(id, operation);
}

export const outsideWorkspace = operation => workspace.run(null, operation);

export function workspaceCollection(id, collection) {
  return prefix(id) + collection;
}

export function workspaceConnection(base) {
  const id = workspaceId();
  if (!id) return base;
  if (!base.db || base.readyState !== 1) throw Object.assign(new Error("Storage unavailable."), { status: 503 });
  let entries = connections.get(base);
  if (!entries) connections.set(base, entries = new Map());
  const cached = entries.get(id);
  if (cached) {
    cached.usedAt = Date.now();
    return cached.connection;
  }
  // Each logical connection gets its own model registry for populate(), while
  // all collections stay inside the two provisioned physical databases.
  const logicalName = `community_${id}`;
  for (const [key, entry] of entries) {
    if (entry.usedAt > Date.now() - 10 * 60_000) continue;
    base.removeDb(entry.connection.name).catch(() => {});
    entries.delete(key);
  }
  const connection = base.useDb(logicalName, { useCache: true });
  connection.db = base.db;
  const collection = connection.collection.bind(connection);
  connection.collection = (name, options) => collection(workspaceCollection(id, name), options);
  for (const model of Object.values(base.models)) {
    const schema = model.schema.clone();
    schema.set("autoCreate", false);
    if (model.modelName === "Player") schema.path("name").index(false);
    connection.model(model.modelName, schema, model.collection.name);
  }
  entries.set(id, { connection, usedAt: Date.now() });
  return connection;
}

export const coreWorkspaceConnection = () => workspaceConnection(mongoose.connection);

export async function readyWorkspace(base) {
  const connection = workspaceConnection(base);
  await Promise.all(Object.values(connection.models).map(model => model.init()));
  return connection;
}

// Model instances and queries are created by the actual scoped model. The
// exported reference chooses that model at call time, including direct `new`.
export function workspaceModel(baseModel) {
  const active = () => workspaceConnection(baseModel.db).models[baseModel.modelName];
  return new Proxy(baseModel, {
    get(target, key) {
      const model = active();
      const value = Reflect.get(model, key, model);
      return typeof value === "function" && key !== "prototype" ? value.bind(model) : value;
    },
    construct(_target, args) { return Reflect.construct(active(), args); },
    apply(_target, _this, args) { return Reflect.apply(active(), undefined, args); },
  });
}
