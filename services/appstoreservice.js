import jwt from 'jsonwebtoken';
import axios from 'axios';

export class AppStoreService {
  #api_url = 'https://api.appstoreconnect.apple.com/v1';

  constructor(issuerId, keyId, key) {
    this.issuerId = issuerId;
    this.keyId = keyId;
    this.key = key;
  }

  async getBuilds(app_id, limit = 5) {
    const api = '/builds';
    const query = '?filter[app]=' + app_id + '&limit=' + limit + '&sort=-uploadedDate';
    const url = this.#api_url + api + query;

    try { 
      const response = await axios.get(url, this.#getConfig());
      return response.data.data.map(build => 
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

  async getLocalization(build_id) {
    const api = '/builds';
    const url = this.#api_url + api + `/${build_id}` + '/betaBuildLocalizations';

    try { 
      const response = await axios.get(url, this.#getConfig());
      return response.data.data.map(localizations =>
        ({
          id: localizations.id,
          whatsNew: localizations.attributes.whatsNew,
          locale: localizations.attributes.locale
        })
      )[0]
    } catch (error) {
      // Handle error
      throw error;
    }
  }

  async setChangelog(localization_id, changelog) {
    const api = '/betaBuildLocalizations';
    const url = this.#api_url + api + `/${localization_id}`;
    const data = {
      data: {
        id: `${localization_id}`,
        type: 'betaBuildLocalizations',
        attributes: {
          whatsNew: `${changelog}`
        }
      }
    };

    try { 
      const response = await axios.patch(url, data, this.#getConfig());
      return response.data.data;
    } catch (error) {
      // Handle error
      throw error;
    }
  }

  async setUsesNonExemptEncryption(build_id) {
    const api = '/builds';
    const url = this.#api_url + api + `/${build_id}`;
    const data = {
      data: {
        id: `${build_id}`,
        type: 'builds',
        attributes: {
          usesNonExemptEncryption: false
        }
      }
    };

    try { 
      const response = await axios.patch(url, data, this.#getConfig());
      return response.data.data;
    } catch (error) {
      // Handle error
      throw error;
    }
  }

  debug_jwt_token() {
    return this.#generateJwtToken();
  }

  #generateJwtToken() {
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

  #getConfig() {
    const jwtToken = this.#generateJwtToken();

    return {
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      }
    }
  }  
}