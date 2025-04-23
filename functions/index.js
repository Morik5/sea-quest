import express from "express";
import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import path from "path";
import { fileURLToPath } from "url";

// Initialize Firebase Admin
initializeApp();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "../dist");

// Serve static files with caching headers
app.use(express.static(distPath, {
  immutable: true,
  maxAge: '1y'
}));

// Load the Qwik handler lazily
let qwikHandler = null;
async function loadQwikHandler() {
  if (qwikHandler) return qwikHandler;
  
  try {
    console.log("Loading Qwik SSR handler...");
    const serverModule = await import('./server/entry-firebase.js');
    qwikHandler = serverModule.onRequest;
    console.log("Qwik SSR handler loaded successfully");
    return qwikHandler;
  } catch (e) {
    console.error("Error importing Qwik entry point:", e);
    return null;
  }
}

// Middleware to handle all routes with Qwik SSR
app.all('*', async (req, res, next) => {
  console.log(`Received request for path: ${req.path}`);
  const handler = await loadQwikHandler();
  if (handler) {
    return handler(req, res);
  }
  console.log("No handler available, passing to next middleware");
  next();
});

// Fallback
app.use((req, res) => {
  console.log(`Fallback triggered for path: ${req.path}`);
  res.status(404).send('Not found');
});

// Export the Cloud Function
export const ssrApp = onRequest(
  {
    region: "europe-west4",
    memory: "1GiB",
    timeoutSeconds: 300,
    minInstances: 0,
  },
  app
);


