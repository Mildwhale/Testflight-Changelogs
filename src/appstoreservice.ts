import * as jwt from 'jsonwebtoken';
import axios, { AxiosRequestConfig } from 'axios';

export interface App {
  id: string;
  bundleId: string;
  name: string;
}

export interface Build {
  id: string;
  version: string;
  expired: boolean;
  processingState: string;
  usesNonExemptEncryption?: boolean;
}

export interface Localization {
  id: string;
  whatsNew: string;
  locale: string;
}

export interface PreReleaseVersion {
  id: string;
  version: string;
}

export class AppStoreService {
  private baseUrl = 'https://api.appstoreconnect.apple.com/v1';
  private issuerId: string
  private keyId: string
  private key: string

  constructor(issuerId: string, keyId: string, key: string) {
    this.issuerId = issuerId;
    this.keyId = keyId;
    this.key = key;
  }

  public async getApp(appId: string): Promise<App> {
    const api = '/apps';
    const query = '?filter[id]=' + appId + '&fields[apps]=name,bundleId';
    const url = this.baseUrl + api + query;

    try {
      const response = await axios.get(url, this.getConfig());
      const app = response.data.data[0];

      return {
        id: app.id,
        bundleId: app.attributes.bundleId,
        name: app.attributes.name
      }
    } catch (error) {
      // Handle error
      throw error;
    }
  }

  public async getBuilds(appId: string, limit = 5): Promise<[Build]> {
    const api = '/builds';
    const query = '?filter[app]=' + appId + '&limit=' + limit + '&sort=-uploadedDate';
    const url = this.baseUrl + api + query;

    try {
      const response = await axios.get(url, this.getConfig());

      return response.data.data.map((build: any): Build =>
      ({
        id: build.id,
        version: build.attributes.version,
        expired: build.attributes.expired,
        processingState: build.attributes.processingState,
        usesNonExemptEncryption: build.attributes.usesNonExemptEncryption
      })
      );
    } catch (error) {
      // Handle error
      throw error;
    }
  }

  public async getLocalization(buildId: string): Promise<Localization> {
    const api = '/builds';
    const url = this.baseUrl + api + `/${buildId}` + '/betaBuildLocalizations';

    try {
      const response = await axios.get(url, this.getConfig());
      const localization: any = response.data.data[0];

      return {
        id: localization.id,
        whatsNew: localization.attributes.whatsNew,
        locale: localization.attributes.locael
      }
    } catch (error) {
      // Handle error
      throw error;
    }
  }

  public async setChangelog(localizationId: string, changelog: string): Promise<Localization> {
    const api = '/betaBuildLocalizations';
    const url = this.baseUrl + api + `/${localizationId}`;
    const data = {
      data: {
        id: `${localizationId}`,
        type: 'betaBuildLocalizations',
        attributes: {
          whatsNew: `${changelog}`
        }
      }
    };

    try {
      const response = await axios.patch(url, data, this.getConfig());
      const localization = response.data.data;

      return {
        id: localization.id,
        whatsNew: localization.attributes.whatsNew,
        locale: localization.attributes.locael
      }
    } catch (error) {
      // Handle error
      throw error;
    }
  }

  public async getPreReleaseVersion(buildId: String): Promise<PreReleaseVersion> {
    const api = '/builds';
    const url = this.baseUrl + api + `/${buildId}` + '/preReleaseVersion';

    try {
      const response = await axios.get(url, this.getConfig());
      const preReleaseVersion: any = response.data.data;

      return {
        id: preReleaseVersion.id,
        version: preReleaseVersion.attributes.version
      }
    } catch (error) {
      // Handle error
      throw error;
    }
  }

  public async setUsesNonExemptEncryption(buildId: string): Promise<Build> {
    const api = '/builds';
    const url = this.baseUrl + api + `/${buildId}`;
    const data = {
      data: {
        id: `${buildId}`,
        type: 'builds',
        attributes: {
          usesNonExemptEncryption: false
        }
      }
    };

    try {
      const response = await axios.patch(url, data, this.getConfig());
      const build = response.data.data;
      
      return {
        id: build.id,
        version: build.attributes.version,
        expired: build.attributes.expired,
        processingState: build.attributes.processingState,
        usesNonExemptEncryption: build.attributes.usesNonExemptEncryption
      }
    } catch (error) {
      // Handle error
      throw error;
    }
  }

  public generateJwtToken(): string {
    const payload = {
      iss: this.issuerId,
      aud: 'appstoreconnect-v1',
      exp: Math.floor(Date.now() / 1000) + (2 * 60)
    };

    return jwt.sign(
      payload,
      this.key,
      {
        algorithm: 'ES256',
        keyid: this.keyId
      }
    );
  }

  private getConfig(): AxiosRequestConfig {
    const jwtToken = this.generateJwtToken();
    return {
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'    
      }
    }
  }
}