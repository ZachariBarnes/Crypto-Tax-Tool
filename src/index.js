import dotenv from 'dotenv';
import logger from 'npmlog';
import app from './api.js';
import ProcessingController from './controllers/processingController.js';

dotenv.config();
const env = process.env.NODE_ENV || 'development';
let api = process.env.API;
api = !!(api === true || api === 'true');
const testEnv = env === 'developement' || env === 'local';
const myUrl = testEnv ? process.env.URL : 'http://localhost';
const port = testEnv ? process.env.PORT : 8080;
logger.info('Starting Tax App. Version:', process.env.npm_package_version);

async function ProcessRequest() {
  const AppController = new ProcessingController();
  await AppController.lookupAndProcessPendingRequests();
}

if (api) {
  app.listen(port, () => logger.info(`App running at: ${myUrl}:${port}`));
}
else {
  ProcessRequest();
}
