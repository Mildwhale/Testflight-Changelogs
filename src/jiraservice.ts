import { logger } from './winston';
import { v4 as uuidv4 } from 'uuid';
import { AppStoreService } from './appstoreservice';
import { ToadScheduler, SimpleIntervalJob, AsyncTask } from 'toad-scheduler';
import fs from 'fs';
import JiraApi from 'jira-client';

export class JiraService {
  private appStoreService: AppStoreService
  private scheduler: ToadScheduler
  private tryCountCache: Map<string, number>
  private jiraClient: JiraApi
  private issueIdRegEx = /([a-zA-Z0-9]+-[0-9]+)/g;

  constructor() {
    this.appStoreService = new AppStoreService(
      process.env.ISSUER_ID ?? '',
      process.env.KEY_ID ?? '',
      fs.readFileSync(process.env.CERTIFICATE_FILE_PATH || '').toString()
    );
    this.scheduler = new ToadScheduler();
    this.tryCountCache = new Map();
    this.jiraClient = new JiraApi({
      protocol: 'https',
      host: process.env.JIRA_BASE_URL ?? '',
      apiVersion: '3',
      username: process.env.JIRA_CLIENT_ID ?? '',
      password: process.env.JIRA_CLIENT_TOKEN ?? '',
    })
  }

  public startScheduledJob(branch: string, appId: string, buildNumber: string, changelog: string): boolean {
    // Validate parameters
    if (!this.validateChangelogParameters(branch, appId, buildNumber, changelog)) {
      return false
    }

    // Set Cache
    const interval = +(process.env.INTERVAL_MINUTE || '3');
    const uuid = uuidv4();
    this.tryCountCache.set(uuid, 0);

    // Make AsyncTask
    const maxTryCount = 20;
    const asyncTask = new AsyncTask(uuid, async () => {
      const tryCount = this.tryCountCache.get(uuid) ?? 0;

      logger.info(`[${uuid}] Start task (${tryCount} of ${maxTryCount}).`);

      try {
        // Builds
        const builds = await this.appStoreService.getBuilds(appId, 10);
        const build = builds.find(build => build.version === buildNumber);

        if (build?.expired ?? false) {
          throw new Error(`[${uuid}] Expired build.`);
        }

        if ((build?.processingState ?? '') !== 'VALID') {
          if (tryCount >= maxTryCount) {
            throw new Error(`[${ uuid }] Timeout.`);
          } else {
            this.tryCountCache.set(uuid, tryCount + 1);
            logger.info(`[${uuid}] Processing not finished, the task will resume after ${interval} minutes.`);
            return
          }
        }

        logger.info(`[${uuid}] Processing finished.`);
        logger.debug(JSON.stringify(build));

        // Get app info
        const app = await this.appStoreService.getApp(appId);

        // JIRA ADD COMMENT
        const issueKey = await this.findIssueKeyIn(branch);
        logger.info(`[${uuid}] Issue key => ${issueKey.issue}`);

        const addCommentResult = await this.jiraClient.addCommentAdvanced(
          issueKey.issue,
          this.makeComment(app.name, buildNumber, changelog)
        )

        logger.info(`[${uuid}] Comment added.`);
        logger.debug(JSON.stringify(addCommentResult));

        // Finish
        this.removeJobById(uuid);
        logger.info(`[${uuid}] Task finished (${tryCount + 1} of ${maxTryCount}).`);
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
    logger.info(`[${uuid}] Task will start soon.`);

    return true
  }

  private removeJobById(uuid: string) {
    this.scheduler.removeById(uuid);

    if (this.tryCountCache.has(uuid)) {
      this.tryCountCache.delete(uuid);
    }
  }

  private validateChangelogParameters(branch: string, appId: string, buildNumber: string, changelog: string): boolean {
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

    if (!isValid(branch)) {
      logger.error('Invalid branch.');
      return false
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

  private async findIssueKeyIn(searchStr: string) {
    const match = searchStr.match(this.issueIdRegEx);

    logger.info(`Searching in string: ${searchStr}`)

    if (!match) {
      throw new Error(`String does not contain issueKeys.`);
    }

    for (const issueKey of match) {
      const issue = await this.jiraClient.getIssue(issueKey);

      if (issue) {
        return { issue: issue.key }
      }
    }
    
    throw new Error(`Can't found issueKeys.`);
  }

  private makeComment(name: string, buildNumber: string, changelog: string) {
    return {
      body: {
        "version": 1,
        "type": "doc",
        "content": [
          {
            "type": "heading",
            "attrs": {
              "level": 2
            },
            "content": [
              {
                "type": "emoji",
                "attrs": {
                  "shortName": ":train2:",
                  "id": "1f686",
                  "text": "🚆"
                }
              },
              {
                "type": "text",
                "text": ` ${name} 앱 배포 알림 `
              },
              {
                "type": "emoji",
                "attrs": {
                  "shortName": ":train2:",
                  "id": "1f686",
                  "text": "🚆"
                }
              }
            ]
          },
          {
            "type": "paragraph",
            "content": [
              {
                "type": "text",
                "text": "빌드 번호",
                "marks": [
                  {
                    "type": "strong"
                  }
                ]
              }
            ]
          },
          {
            "type": "paragraph",
            "content": [
              {
                "type": "text",
                "text": `${buildNumber}`
              }
            ]
          },
          {
            "type": "paragraph",
            "content": [
              {
                "type": "text",
                "text": "변경 사항",
                "marks": [
                  {
                    "type": "strong"
                  }
                ]
              }
            ]
          },
          {
            "type": "blockquote",
            "content": [
              {
                "type": "paragraph",
                "content": [
                  {
                    "type": "text",
                    "text": `${changelog}`
                  }
                ]
              }
            ]
          }
        ]
      }
    }
  }
}