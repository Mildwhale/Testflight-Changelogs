import { AppStoreService } from './appstoreservice.js';
import { v4 as uuidv4 } from 'uuid';
import { ToadScheduler, SimpleIntervalJob, AsyncTask } from 'toad-scheduler';

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
    console.log(`[DEBUG] AppId: ${ appId }, BuildNumber: ${ buildNumber }, Changelog: ${ changelog }`);

    // Set Cache
    const uuid = uuidv4();
    console.log('[DEBUG] UUID: ' + uuid);

    this.tryCountCache[uuid] = 0;

    // Make AsyncTask
    const maxTryCount = process.env.RETRY_COUNT || 10;
    const asyncTask = new AsyncTask(uuid, async () => {
      const tryCount = this.tryCountCache[uuid];
  
      console.log(`===== Task Started (${tryCount + 1} of ${maxTryCount}) =====`);
  
      try {
        // Builds
        const builds = await this.appStoreService.getBuilds(appId, 10);
        const build = builds.find(build => build.version === buildNumber);
  
        if (!build) {
          if (tryCount >= maxTryCount) {
            throw Error('[Error] Timeout.');
          } else {
            this.tryCountCache[uuid] = tryCount + 1;
            console.log(`[VERBOSE] Can't found build, the task will resume.`);
            return
          }
        } else if (build.expired) {
          throw Error('[ERROR] Expired build: ' + buildNumber);
        }
  
        console.log('[DEBUG] Build founded.');
        console.log(build);
  
        // Localization
        const localization = await this.appStoreService.getLocalization(build.id);
  
        if (!localization) {
          throw Error('[ERROR] Localization not found.');
        } else if (localization.whatsNew) {
          throw Error('[ERROR] Changelog already exist.');
        }
  
        console.log('[DEBUG] Localization received.');
        console.log(localization);
  
        // SetChangelog
        const resultOfSetChangelog = await this.appStoreService.setChangelog(localization.id, changelog);
        console.log('[DEBUG] SetChangelog finished.');
        console.log(resultOfSetChangelog);
  
        // SetUsesNonExemptEncryption
        const resultOfSetEncryption = await this.appStoreService.setUsesNonExemptEncryption(build.id);
        console.log('[DEBUG] setEncryption finished.');
        console.log(resultOfSetEncryption);
  
        // Finish
        this.#removeJobById(uuid);
        console.log(`===== Task Finished (${tryCount + 1} of ${maxTryCount}) =====`);
      } catch (error) {
        throw error;
      }
    }, (error) => {
      console.log(error);
      this.#removeJobById(uuid);
    })
  
    // Make IntervalJob
    const interval = process.env.INTERVAL_MINUTE || 3;
    const job = new SimpleIntervalJob({ minutes: interval }, asyncTask, uuid);
  
    // Set Scheduler
    this.scheduler.addSimpleIntervalJob(job);

    return true
  }

  #removeJobById(uuid) {
    this.scheduler.removeById(uuid);
    delete this.tryCountCache[uuid];
  }

  #validateChangelogParameters(appId, buildNumber, changelog) {
    function isValid(value) {
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

    if (!isValid(appId)) {
      console.log('invalid app_id');
      return false
    }

    if (!isValid(buildNumber)) {
      console.log('invalid build_number');
      return false
    }

    if (!isValid(changelog)) {
      console.log('invalid changelog');
      return false
    }

    return true
  }
}