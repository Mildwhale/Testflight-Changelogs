import { logger } from './winston';
import { v4 as uuidv4 } from 'uuid';
import { AppStoreService } from './appstoreservice';
import { ToadScheduler, SimpleIntervalJob, AsyncTask } from 'toad-scheduler';
import fs from 'fs';

export class ChangelogService {
  private appStoreService: AppStoreService
  private scheduler: ToadScheduler
  private tryCountCache: Map<string, number>

  constructor() { 
    this.appStoreService = new AppStoreService(
      process.env.ISSUER_ID ?? '', 
      process.env.KEY_ID ?? '', 
      fs.readFileSync(process.env.CERTIFICATE_FILE_PATH || '').toString()
    );
    this.scheduler = new ToadScheduler();
    this.tryCountCache = new Map();
  }

  public startScheduledJob(appId: string, buildNumber: string, changelog: string): boolean {
    // Validate parameters
    if (!this.validateChangelogParameters(appId, buildNumber, changelog)) {
      return false
    }
    
    // Set Cache
    const interval = +(process.env.INTERVAL_MINUTE || '3');
    const uuid = uuidv4();
    this.tryCountCache.set(uuid, 0);

    // Make AsyncTask
    const maxTryCount = +(process.env.RETRY_COUNT || '10');
    const asyncTask = new AsyncTask(uuid, async () => {
      const tryCount = this.tryCountCache.get(uuid) || 0;
  
      logger.info(`[${ uuid }] Start task (${tryCount} of ${maxTryCount}).`);
  
      try {
        // Builds
        const builds = await this.appStoreService.getBuilds(appId, 10);
        const build = builds.find(build => build.version === buildNumber);

        if (!build) {
          if (tryCount < maxTryCount) {
            this.tryCountCache.set(uuid, tryCount + 1);
            logger.info(`[${ uuid }] Can't found build, the task will resume after ${ interval } minutes.`);
            return
          } else {
            throw new Error(`[${ uuid }] Can't found build. (Timeout)`);
          }
        } else if (build.expired) {
          throw new Error(`[${ uuid }] Expired build.`);
        }
  
        logger.info(`[${ uuid }] Build founded.`);
  
        // Localization
        const localization = await this.appStoreService.getLocalization(build.id);
  
        logger.info(`[${ uuid }] Localization received.`);

        if (!localization) {
          throw new Error(`[${ uuid }] Can't found localization.`);
        } else if (localization.whatsNew) {
          throw new Error(`[${ uuid }] Changelog already exist.`);
        }
  
        // SetChangelog
        await this.appStoreService.setChangelog(localization.id, changelog);
        logger.info(`[${ uuid }] SetChangelog finished.`);
  
        // SetUsesNonExemptEncryption
        await this.appStoreService.setUsesNonExemptEncryption(build.id);
        logger.info(`[${ uuid }] setEncryption finished.`);
  
        // Finish
        this.removeJobById(uuid);
        logger.info(`[${ uuid }] Task finished (${tryCount + 1} of ${maxTryCount}).`);
      } catch (error) {
        throw error;
      }
    }, (error) => {
      logger.error(error.message);
      this.removeJobById(uuid);
    })
  
    // Make IntervalJob
    const job = new SimpleIntervalJob({ minutes: interval }, asyncTask, uuid);
  
    // Set Scheduler
    this.scheduler.addSimpleIntervalJob(job);
    logger.info(`[${ uuid }] Task will start soon.`);

    return true
  }

  public debugJwt(): string {
    return this.appStoreService.generateJwtToken()
  }

  private removeJobById(uuid: string) {
    this.scheduler.removeById(uuid);

    if (this.tryCountCache.has(uuid)) {
      this.tryCountCache.delete(uuid);
    }
  }

  private validateChangelogParameters(appId: string, buildNumber: string, changelog: string): boolean {
    function isValid(value: string) {
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