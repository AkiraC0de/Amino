import { createServer } from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig(process.env);
const app = createApp({});
const server = createServer(app);

server.listen(config.port, () => {
  console.log(`API listening on port ${config.port}`);
});

const shutdown = () => {
  server.close((error) => {
    if (error) {
      process.exitCode = 1;
    }
  });
};

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
