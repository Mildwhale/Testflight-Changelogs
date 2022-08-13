import express from 'express';
import bodyParser from 'body-parser';
import dotEnv from 'dotenv';
import fs from 'fs';
import { ChangelogService } from './changelogservice';
import { logger } from './winston';

dotEnv.config({ path: './env/.env' });

const PORT = process.env.PORT || 4000;
const changelogService = new ChangelogService(
  process.env.ISSUER_ID || '',
  process.env.KEY_ID || '',
  fs.readFileSync(process.env.CERTIFICATE_FILE_PATH || '').toString()
);

const app = express();

app.use(bodyParser.json());

app.get('/', function (_, res) {
  logger.info('GET /');
  res.sendStatus(200);
});

app.post('/changelog', function (req, res) {
  logger.info('POST /changelog');
  logger.info(`${JSON.stringify(req.body)}`);

  // Start Scheduled Job
  if (!changelogService.startScheduledJob(
    req.body.app_id,
    req.body.build_number,
    req.body.changelog)
  ) {
    res.status(400).send('Invalid parameters.');
    return
  }

  res.sendStatus(200);
});

app.listen(PORT, () => {
  logger.info(`Listening on ${PORT}`);
});