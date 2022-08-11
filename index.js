import express from 'express';
import bodyParser from 'body-parser';
import dotEnv from 'dotenv';
import fs from 'fs';
import { AppStoreService } from './appstoreservice.js';
import { v4 as uuidv4, validate } from 'uuid';
import { ToadScheduler, SimpleIntervalJob, AsyncTask } from 'toad-scheduler';

dotEnv.config({ path: './env/.env' });

const PORT = process.env.PORT || 4000;
const appStoreService = new AppStoreService(
  process.env.ISSUER_ID,
  process.env.KEY_ID,
  fs.readFileSync("./env/certificate.p8")
);
const scheduler = new ToadScheduler();
const tryCountCache = {}; // { uuid: count }

express()
  .get('/', function (_, res) {
    res.send('Hello');
  })
  .get('/debug-jwt', function (_, res) {
    res.send(appStoreService.debug_jwt_token());
  })
  .use(bodyParser.json())
  .post('/changelog', function (req, res) {
    console.log('[POST] changelog');

    if (!validateChangelogParameters(req)) {
      res.status(400).send('Invalid parameters.');
      return
    }

    // Set Cache
    const uuid = uuidv4();
    console.log('[DEBUG] UUID: ' + uuid);

    tryCountCache[uuid] = 0;

    // Set Scheduler
    startScheduledJob(
      uuid, 
      req.body.app_id, 
      req.body.build_number, 
      req.body.changelog
    );

    res.sendStatus(200);
  })
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

function validateChangelogParameters(req) {
  if (!isValidParameter(req.body.app_id)) {
    console.log('invalid app_id');
    return false
  }

  if (!isValidParameter(req.body.build_number)) {
    console.log('invalid build_number');
    return false
  }
  
  if (!isValidParameter(req.body.changelog)) {
    console.log('invalid changelog');
    return false
  }

  return true
}

function isValidParameter(value) {
  if (!value) {
    console.log('value is null');
    return false
  }

  if (value.length <= 0) {
    console.log('value is empty');
    return false
  }

  return true
}

function startScheduledJob(uuid, appId, buildNumber, changeLog) {
  const maxTryCount = process.env.RETRY_COUNT || 10;
  
  // Make AsyncTask
  const asyncTask = new AsyncTask(uuid, async () => {
    const tryCount = tryCountCache[uuid];

    console.log(`===== Task Started (${ tryCount + 1 } of ${ maxTryCount }) =====`);

    try {
      const builds = await appStoreService.getBuilds(appId);
      const build = builds.find(build => build.version === buildNumber);

      if (!build) {
        if (tryCount >= maxTryCount) {
          throw Error('[Error] Timeout.');
        } else {
          tryCountCache[uuid] = tryCount + 1;
          console.log(`[VERBOSE] Can't found build, the task will resume.`);
          return
        }
      } else if (build.expired) {
        throw Error('[ERROR] Expired build: ' + buildNumber);
      }
      
      console.log('[DEBUG] Build founded.');
      console.log(build);
      
      const localization = await appStoreService.getLocalization(build.id);

      if (!localization) {  
        throw Error('[ERROR] Localization not found.');
      } else if (localization.whatsNew) {
        throw Error('[ERROR] Changelog already exist.');
      }
      
      console.log('[DEBUG] Localization received.');
      console.log(localization);

      const resultOfSetChangelog = await appStoreService.setChangelog(localization.id, changeLog);
      console.log('[DEBUG] SetChangelog finished.');
      console.log(resultOfSetChangelog);

      const resultOfSetEncryption = await appStoreService.setUsesNonExemptEncryption(build.id);
      console.log('[DEBUG] setEncryption finished.');
      console.log(resultOfSetEncryption);

      removeJobById(uuid);
      console.log(`===== Task Finished (${ tryCount + 1 } of ${ maxTryCount }) =====`);
    } catch (error) {
      throw error;
    }
  }, (error) => {
    console.log(error);
    removeJobById(uuid);
  })

  // Make IntervalJob
  const interval = process.env.INTERVAL_MINUTE || 3;
  const job = new SimpleIntervalJob({ minutes: interval }, asyncTask, uuid);

  // Set Scheduler
  scheduler.addSimpleIntervalJob(job);
}

function removeJobById(uuid) {
  scheduler.removeById(uuid);
  delete tryCountCache[uuid];
}