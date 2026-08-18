import { spawn } from 'node:child_process';
import net from 'node:net';
import process from 'node:process';

const requestedWorkerPort = Number(process.env.LOCAL_WORKER_PORT || 8788);
const requestedVitePort = Number(process.env.VITE_PORT || 5173);
let workerUrl = '';
let healthcheckUrl = '';

const children = [];
let shuttingDown = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isPortFree = (port, host = '127.0.0.1') => new Promise((resolve) => {
  const socket = net.createConnection({ port, host });
  let settled = false;

  const finish = (value) => {
    if (settled) return;
    settled = true;
    socket.destroy();
    resolve(value);
  };

  socket.once('connect', () => finish(false));
  socket.once('timeout', () => finish(false));
  socket.once('error', (error) => {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
    finish(code === 'ECONNREFUSED');
  });
  socket.setTimeout(400);
});

const findAvailablePort = async (preferredPort, label) => {
  let port = preferredPort;
  while (!(await isPortFree(port))) {
    port += 1;
  }
  if (port !== preferredPort) {
    console.log(`[dev-local-stack] ${label} port ${preferredPort} is busy, using ${port} instead`);
  }
  return port;
};

const terminateChildren = (signal = 'SIGTERM') => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      try {
        child.kill(signal);
      } catch {
        // Ignore teardown failures.
      }
    }
  }
};

const attachLifecycle = (child, label) => {
  children.push(child);
  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      if (code === 0 && !signal) {
        console.log(`[dev-local-stack] ${label} exited, stopping local stack`);
      } else {
        console.error(`[dev-local-stack] ${label} exited unexpectedly`, { code, signal });
      }
      terminateChildren();
      process.exitCode = code ?? 1;
    }
  });
};

const waitForWorkerReady = async (timeoutMs = 30000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthcheckUrl);
      if (response.ok || response.status === 204 || response.status === 404 || response.status === 502) {
        return;
      }
    } catch {
      // Retry until timeout.
    }
    await sleep(500);
  }
  throw new Error(`Worker local did not become ready within ${timeoutMs}ms at ${workerUrl}`);
};

const workerPort = await findAvailablePort(requestedWorkerPort, 'worker');
const vitePort = await findAvailablePort(requestedVitePort, 'vite');
workerUrl = `http://127.0.0.1:${workerPort}`;
healthcheckUrl = `${workerUrl}/api/public/rest/site_info?select=id&limit=1`;

const worker = spawn(
  'npx',
  [
    'wrangler',
    'dev',
    '_worker.js',
    '--config',
    'wrangler.jsonc',
    '--assets',
    './public',
    '--ip',
    '127.0.0.1',
    '--port',
    String(workerPort),
    '--local',
  ],
  {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  },
);
attachLifecycle(worker, 'worker');

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    terminateChildren(signal);
  });
}

process.on('exit', () => terminateChildren());

try {
  console.log(`[dev-local-stack] starting worker on ${workerUrl}`);
  await waitForWorkerReady();
  console.log(`[dev-local-stack] worker ready, starting Vite on http://127.0.0.1:${vitePort}`);

  const vite = spawn(
    'npx',
    ['vite', '--host', '--port', String(vitePort), '--strictPort'],
    {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_DATA_BACKEND: process.env.VITE_DATA_BACKEND || 'd1',
        VITE_DEV_PROXY_TARGET: process.env.VITE_DEV_PROXY_TARGET || workerUrl,
      },
    },
  );
  attachLifecycle(vite, 'vite');
} catch (error) {
  console.error('[dev-local-stack] failed to bootstrap local stack:', error);
  terminateChildren();
  process.exit(1);
}
