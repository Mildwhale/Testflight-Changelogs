import jwt from 'jsonwebtoken';

export class AppStoreService {
  constructor(issuerId, keyId, key) {
    this.issuerId = issuerId;
    this.keyId = keyId;
    this.key = key;
  }

  generateJwtToken() {
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
}