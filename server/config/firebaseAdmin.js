import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceAccountPath = process.env.RENDER
  ? "/etc/secrets/firebase-service-account.json"
  : path.join(__dirname, "firebase-service-account.json");

function credentialsFromEnvironment() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

function credentialsFromFile() {
  if (!fs.existsSync(serviceAccountPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
  } catch (error) {
    throw new Error(`Firebase service account JSON could not be read: ${error.message}`);
  }
}

function getFirebaseAdmin() {
  if (getApps().length > 0) return getAuth();
  const serviceAccount = credentialsFromEnvironment() || credentialsFromFile();
  if (!serviceAccount) {
    throw new Error(
      "Firebase Admin credentials are missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or provide server/config/firebase-service-account.json."
    );
  }
  initializeApp({ credential: cert(serviceAccount) });
  return getAuth();
}

export default getFirebaseAdmin;
