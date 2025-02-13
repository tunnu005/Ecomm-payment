import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cluster from 'cluster';
import os from 'os';
import { initializeDatabase } from './dbconnection';
import router from './router';
import { consul } from './consul';


// Load environment variables
dotenv.config();

const numCPUs: number = os.cpus().length;
const BASE_PORT: number = Number(process.env.PORT) || 3033;

if (cluster.isPrimary) {
  console.log(`Master process running with PID: ${process.pid}`);
  console.log(`Forking ${numCPUs} workers...`);

  for (let i = 1; i <= numCPUs; i++) {
    cluster.fork({ WORKER_ID: i });
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} exited. Restarting...`);
    
    // Find the missing worker ID and restart
    const usedIds = new Set(
      Object.values(cluster.workers || {}).map(w => (w?.process as any)?.env?.WORKER_ID)
    );
    
    for (let i = 1; i <= numCPUs; i++) {
      if (!usedIds.has(String(i))) {
        console.log(`Restarting worker with ID ${i}...`);
        cluster.fork({ WORKER_ID: i });
        break;
      }
    }
  });
} else {
  // Worker process
  const workerId = process.env.WORKER_ID || "1";
  const PORT = BASE_PORT + Number(workerId); // Ensure unique ports for workers
  const SERVICE_NAME = "Payment";
  const SERVICE_ID = `${SERVICE_NAME}-${workerId}`;

  const app = express();
  app.use(express.json());

  initializeDatabase();



  // Register the service
  consul.agent.service.register({
    name: SERVICE_NAME,
    id: SERVICE_ID,
    address: "localhost",
    port: PORT,
    checks: [  // Use 'checks' (array) instead of 'check'
      {
        name: `${SERVICE_NAME}-health-check`,
        http: `http://localhost:${PORT}/health`,
        interval: '10s',
        timeout: '2s',
        deregistercriticalserviceafter: '30s'  // Ensure lowercase 'c' in 'critical'
      }
    ]
  }).then(() => {
    console.log(`${SERVICE_ID} registered with Consul`);
  }).catch((err) => {
    console.error("Consul registration failed:", err);
  });
  

  // Health Check Endpoint
  app.get("/health", (req: Request, res: Response) => {
    res.send("OK");
  });

  // API Routes
  app.get("/", (req: Request, res: Response) => {
    res.json({ message: "Welcome to the Review API!" });
  });

  app.use(`/api/${SERVICE_NAME}`, router);

  // Service Discovery Example
  const discoverService = async (serviceName: string) => {
    try {
      const services = await consul.catalog.service.nodes(serviceName);
      // console.log(`Discovered services for ${serviceName}:`, services);
    } catch (error) {
      console.error("Service discovery error:", error);
    }
  };

  // Discover "admin" service example
  discoverService("review");

  app.listen(PORT, () => {
    console.log(`Worker ${workerId} running on port ${PORT}`);
  });
}
