import { AppStoreService } from './appstoreservice.js';
import { v4 as uuidv4 } from 'uuid';
import { ToadScheduler, SimpleIntervalJob, AsyncTask } from 'toad-scheduler';
import { logger } from './winston.js';

export class ChangelogService {
  constructor(issuerId, keyId, key) {
    this.appStoreService = new AppStoreService(issuerId, keyId, key);
    this.scheduler = new ToadScheduler();
    this.tryCountCache = {}; // { uuid: count }
  }

  startScheduledJob(appId, buildNumber, changelog) {
    // Validate parameters
    if (!this.#validateChangelogParameters(appId, buildNumber, changelog)) {
      return false
    }
    
    // Set Cache
    const interval = process.env.INTERVAL_MINUTE || 3;
    const uuid = uuidv4();
    this.tryCountCache[uuid] = 0;

    // Make AsyncTask
    const maxTryCount = process.env.RETRY_COUNT || 10;
    const asyncTask = new AsyncTask(uuid, async () => {
      const tryCount = this.tryCountCache[uuid];
  
      logger.info(`[${ uuid }] Start task (${tryCount + 1} of ${maxTryCount}).`);
  
      try {
        // Builds
        const builds = await this.appStoreService.getBuilds(appId, 10);
        const build = builds.find(build => build.version === buildNumber);
  
        if (!build) {
          if (tryCount >= maxTryCount) {
            throw Error(`[${ uuid }] Can't found build. (Timeout)`);
          } else {
            this.tryCountCache[uuid] = tryCount + 1;
            logger.info(`[${ uuid }] Can't found build, the task will resume after ${ interval } minutes.`);
            return
          }
        } else if (build.expired) {
          throw Error(`[${ uuid }] Expired build.`);
        }
  
        logger.info(`[${ uuid }] Build founded.`);
        logger.debug(JSON.stringify(build));
  
        // Localization
        const localization = await this.appStoreService.getLocalization(build.id);
  
        if (!localization) {
          throw Error(`[${ uuid }] Can't found localization.`);
        } else if (localization.whatsNew) {
          throw Error(`[${ uuid }] Changelog already exist.`);
        }
  
        logger.info(`[${ uuid }] Localization received.`);
        logger.debug(JSON.stringify(localization));
  
        // SetChangelog
        const resultOfSetChangelog = await this.appStoreService.setChangelog(localization.id, changelog);
        logger.info(`[${ uuid }] SetChangelog finished.`);
        logger.debug(JSON.stringify(resultOfSetChangelog));
  
        // SetUsesNonExemptEncryption
        const resultOfSetEncryption = await this.appStoreService.setUsesNonExemptEncryption(build.id);
        logger.info(`[${ uuid }] setEncryption finished.`);
        logger.debug(JSON.stringify(resultOfSetEncryption));
  
        // Finish
        this.#removeJobById(uuid);
        logger.info(`[${ uuid }] Task finished (${tryCount + 1} of ${maxTryCount}).`);
      } catch (error) {
        throw error;
      }
    }, (error) => {
      logger.error(error);
      this.#removeJobById(uuid);
    })
  
    // Make IntervalJob
    const job = new SimpleIntervalJob({ minutes: interval }, asyncTask, uuid);
  
    // Set Scheduler
    this.scheduler.addSimpleIntervalJob(job);
    logger.info(`[${ uuid }] Task will start soon.`);

    return true
  }

  #removeJobById(uuid) {
    this.scheduler.removeById(uuid);
    delete this.tryCountCache[uuid];
  }

  #validateChangelogParameters(appId, buildNumber, changelog) {
    function isValid(value) {
      if (!value) {
        logger.error('Undefined value.');
        return false
      }
    
      if (value.length <= 0) {
        logger.error('Empty value.');
        return false
      }
    
      return true
    }

    if (!isValid(appId)) {
      logger.error('Invalid app_id.');
      return false
    }

    if (!isValid(buildNumber)) {
      logger.error('Invalid build_number.');
      return false
    }

    if (!isValid(changelog)) {
      logger.error('Invalid changelog.');
      return false
    }

    return true
  }
}