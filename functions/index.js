import express from "express";
import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import path from "path";
import { fileURLToPath } from "url";

// Initialize Firebase Admin
initializeApp();

// Create Express app
const app = express();

// Set up paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "../dist");

// Serve static assets
app.use(express.static(distPath, {
  immutable: true,
  maxAge: '1y'
}));

// Import Qwik server handler dynamically
let qwikHandler = null;
async function loadQwikHandler() {
  if (qwikHandler) return qwikHandler;
  
  try {
    // This needs to be imported dynamically
    const serverModule = await import('./server/entry.firebase.js');
    qwikHandler = serverModule.onRequest;
    return qwikHandler;
  } catch (e) {
    console.error("Error importing Qwik entry point:", e);
    return null;
  }
}

// Default to Qwik SSR handler
app.use(async (req, res, next) => {
  const handler = await loadQwikHandler();
  if (handler) {
    return handler(req, res);
  }
  next();
});

// Create HTTP function for Firebase
export const ssrApp = onRequest(
  {
    region: "europe-west4",
    memory: "1GiB",
    timeoutSeconds: 300,
    minInstances: 0,
  },
  app
);

