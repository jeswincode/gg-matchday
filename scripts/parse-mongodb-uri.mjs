import { isIP } from "node:net";

// Emit only sanitized routing metadata. Never echo the connection string, user info,
// options, or raw parser exceptions; callers may safely display this output.
const raw = String(process.env.MONGODB_URI || "");
const fail = () => {
  process.stderr.write("Invalid MongoDB connection URI.\n");
  process.exit(2);
};

const prefix = raw.match(/^(mongodb(?:\+srv)?:\/\/)/);
if (!prefix || /[\u0000-\u0020]/.test(raw)) fail();

const remainder = raw.slice(prefix[0].length);
const boundary = remainder.search(/[/?#]/);
const authorityWithCredentials = boundary < 0 ? remainder : remainder.slice(0, boundary);
const tail = boundary < 0 ? "" : remainder.slice(boundary);
const at = authorityWithCredentials.lastIndexOf("@");
const authority = at >= 0 ? authorityWithCredentials.slice(at + 1) : authorityWithCredentials;
if (!authority || authority.includes("@")) fail();

const protocol = prefix[1];
if (protocol === "mongodb+srv://" && authority.includes(",")) fail();

const hosts = authority.split(",");
if (!hosts.length || hosts.some(host => !host)) fail();

function validHost(host) {
  if (host.startsWith("[")) {
    const match = host.match(/^\[([0-9a-fA-F:.]+)\](?::([0-9]{1,5}))?$/);
    if (!match || isIP(match[1]) !== 6) return false;
    return match[2] === undefined || Number(match[2]) <= 65535;
  }
  const match = host.match(/^([A-Za-z0-9._-]+)(?::([0-9]{1,5}))?$/);
  if (!match) return false;
  const hostName = match[1];
  if (!hostName || hostName.startsWith(".") || hostName.endsWith(".") ||
      hostName.includes("..") || hostName.split(".").some(label => !label || label.startsWith("-") || label.endsWith("-"))) {
    return false;
  }
  return match[2] === undefined || Number(match[2]) <= 65535;
}
if (hosts.some(host => !validHost(host))) fail();

let pathPart = tail;
const query = pathPart.indexOf("?");
const fragment = pathPart.indexOf("#");
const cut = [query, fragment].filter(index => index >= 0).reduce((a, b) => Math.min(a, b), pathPart.length);
pathPart = pathPart.slice(0, cut);

let database = "";
if (pathPart) {
  if (!pathPart.startsWith("/")) fail();
  const rawDatabase = pathPart.slice(1).split("/")[0];
  try {
    database = decodeURIComponent(rawDatabase);
  } catch {
    fail();
  }
  if (database.includes("/") || database.includes("\\") || /[\u0000-\u001f]/.test(database)) fail();
}

// A tab/newline in URI authority or decoded DB name would corrupt the output format.
if (hosts.join(",").includes("\t") || database.includes("\t") || database.includes("\n")) fail();
process.stdout.write(hosts.join(",") + "\t" + database + "\n");
