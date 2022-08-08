import express from 'express';
import dotEnv from 'dotenv';
import fs from 'fs';
import { AppStoreService } from './appstoreservice.js';

dotEnv.config({ path: './env/.env' });

const PORT = process.env.PORT || 4000;
const appStoreService = new AppStoreService(
  process.env.ISSUER_ID,
  process.env.KEY_ID,
  fs.readFileSync("./env/certificate.p8")
);

express()
  .get('/', function (_, res) {
    res.send('Hello');
  })
  .get('/debug-jwt', function (_, res) {
    res.send(appStoreService.generateJwtToken());
  })
  .listen(PORT, () => console.log(`Listening on ${PORT}`));
  