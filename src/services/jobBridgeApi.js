import http from 'http';
import { logger } from '../utils/logger.js';

const DEFAULT_PORT = 35123;

export class JobBridgeApi {
  constructor(campaignManager) {
    this.cm = campaignManager;
    this.server = null;
  }

  start(port = DEFAULT_PORT) {
    this.server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');

      if (req.method === 'GET' && req.url === '/health') {
        return this._handleHealth(res);
      }

      if (req.method === 'POST' && req.url === '/api/jobs/new') {
        return this._handleNewJob(req, res);
      }

      res.writeHead(404);
      res.end(JSON.stringify({ status: 'error', error: 'Not found' }));
    });

    this.server.listen(port, '127.0.0.1', () => {
      logger.success(`JobBridgeApi listening on 127.0.0.1:${port}`);
    });

    this.server.on('error', (err) => {
      logger.error('JobBridgeApi server error:', err.message);
    });

    return this;
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
      logger.info('JobBridgeApi stopped');
    }
  }

  _handleHealth(res) {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
  }

  _handleNewJob(req, res) {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        if (!payload || !payload.job || !payload.job.title) {
          res.writeHead(400);
          return res.end(JSON.stringify({ status: 'error', error: 'Missing required field: job.title' }));
        }
        const channelInfo = payload.job.discord_channel_id
          ? ` channel_id=${payload.job.discord_channel_id}${payload.job.discord_channel_name ? ` (${payload.job.discord_channel_name})` : ''}`
          : '';
        logger.info(`Bridge received job: "${payload.job.title}" (source: ${payload.source || 'unknown'})${channelInfo}`);
        const result = await this.cm.processSingleJob(payload.job, payload.source || 'bridge');
        logger.success(`Bridge result for "${payload.job.title}": ${result.status}`);
        res.writeHead(200);
        res.end(JSON.stringify(result));
      } catch (err) {
        logger.error('Bridge API error:', err.message);
        res.writeHead(500);
        res.end(JSON.stringify({ status: 'error', error: err.message }));
      }
    });
    req.on('error', (err) => {
      logger.error('Bridge request error:', err.message);
      res.writeHead(500);
      res.end(JSON.stringify({ status: 'error', error: err.message }));
    });
  }
}
