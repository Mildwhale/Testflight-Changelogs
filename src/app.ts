import express from 'express';
import bodyParser from 'body-parser';
import dotEnv from 'dotenv';
import serveIndex from 'serve-index';
import { ChangelogService } from './changelogservice';
import { JiraService } from './jiraservice';
import { logger } from './winston';

dotEnv.config({ path: './env/.env' });

const PORT = process.env.PORT || 4000;
const OUTPUT_PATH = process.env.OUTPUT_PATH || '../outputs';
const changelogService = new ChangelogService();
const jiraService = new JiraService();

const app = express();

app.use(bodyParser.json());

app.get('/', function (_, res) {
  logger.info('GET /');
  res.sendStatus(200);
});

app.get('/debug', function(_, res) {
  res.send(changelogService.debugJwt());
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

app.post('/jiraDeployComment', function (req, res) {
  logger.info('POST /jiraDeployComment');
  logger.info(`${JSON.stringify(req.body)}`);

  // Start Scheduled Job
  if (!jiraService.startScheduledJob(
    req.body.branch,
    req.body.app_id,
    req.body.build_number,
    req.body.changelog)
  ) {
    res.status(400).send('Invalid parameters.');
    return
  }

  res.sendStatus(200);
});

app.use('/outputs', express.static(OUTPUT_PATH), serveIndex(OUTPUT_PATH, {'icons': true, 'view': 'details'}));

app.listen(PORT, () => {
  logger.info(`Listening on ${PORT}`);
});