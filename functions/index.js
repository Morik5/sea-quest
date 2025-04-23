import express from "express";
import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import path from "path";
import { fileURLToPath } from "url";


initializeApp();


const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "../dist");


app.use(express.static(distPath, {
  immutable: true,
  maxAge: '1y'
}));


let qwikHandler = null;
async function loadQwikHandler() {
  if (qwikHandler) return qwikHandler;
  
  try {

    const serverModule = await import('./server/entry.firebase.js');
    qwikHandler = serverModule.onRequest;
    return qwikHandler;
  } catch (e) {
    console.error("Error importing Qwik entry point:", e);
    return null;
  }
}


app.use(async (req, res, next) => {
  const handler = await loadQwikHandler();
  if (handler) {
    return handler(req, res);
  }
  next();
});


export const ssrApp = onRequest(
  {
    region: "europe-west4",
    memory: "1GiB",
    timeoutSeconds: 300,
    minInstances: 0,
  },
  app
);


if (process.env.NODE_ENV !== 'production') {
  const startServer = () => {
    const PORT = process.env.PORT || 8080;
    try {
      const server = app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
      });

      
      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.log(`Port ${PORT} is already in use, trying another port...`);
          
          server.close();
          process.env.PORT = String(parseInt(process.env.PORT || '8080') + 1);
          startServer();
        } else {
          console.error('Server error:', error);
        }
      });
    } catch (error) {
      console.error('Failed to start server:', error);
    }
  };

  startServer();
}

