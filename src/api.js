/* eslint-disable no-restricted-syntax */
import express from 'express';
import logger from 'npmlog';
// import pkg from 'cors';
import { getGenericError, generateUUID } from './utils/utilities.js';
import AWSController, { REQUEST_STATUS } from './controllers/subControllers/awsController.js';
import ProcessingController from './controllers/processingController.js';
import { configMap } from './configs/coinConfigs.js';

// const { cors } = pkg;
const awsController = new AWSController();
const controller = new ProcessingController();
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// app.use(cors());

app.get('/', async (req, res) => res.status(200).send({
  message: 'Welcome to Vidulum Tax Tool',
  status: 'healthy',
  error: false,
}));

app.get('/supported-coins', async (req, res) => {
  const supportedCoins = Array.from(configMap.keys()).map((key) => key);
  return res.status(200).send({
    message: `Supported coins are ${supportedCoins}`,
    coins: supportedCoins,
    status: 'healthy',
    error: false,

  });
});

app.post('/collect-transaction-history/', async (req, res) => {
  logger.info('collect-transaction-history called');
  const { addresses, emailAddress } = req.body;
  logger.info(`get-transaction-history called for: ${addresses.length} wallet addresses, email:`, emailAddress);

  try {
    const guid = generateUUID();
    await awsController.write({ id: guid, value: req.body });
    await awsController.addRequestToStatus(guid, REQUEST_STATUS.PENDING);
    logger.info(`Adding ${guid} to ${REQUEST_STATUS.PENDING}`);
    await awsController.writeStartTaskEvent();
    return res.status(200).send({
      message: `request recieved, we will start the task to process this order for: ${emailAddress}. Your Request ID is: ${guid}`,
      requestId: guid,
      error: false,
    });
  }
  catch (error) {
    return res.status(400).send(getGenericError(error));
  }
});

/* Deprecated, Use only for Local Testing */
app.post('/process-request/', async (req, res) => {
  const { addresses, cutoffDate, emailAddress } = req.body;
  logger.info(`get-transaction-history called for: ${addresses.length} wallet addresses, email:`, emailAddress);
  const errors = [];
  for (const wallet of addresses) {
    const { coinSymbol, walletAddress } = wallet;
    const validAddress = await controller.ValidateAddress(walletAddress, coinSymbol);
    if (!validAddress) {
      errors.push({
        message: `Failed to validate address: ${walletAddress} for coin/token: ${coinSymbol}`,
        error: true,
      });
    }

    if (errors.length > 0) {
      return res.status(400).send({
        message: 'Failed to validate one or more addressess. Remove or correct the invalid wallet addresses.',
        error: true,
        errors,
      });
    }
  }
  try {
    controller.createAndSendTransactionHistoryForAllAddresses(addresses, emailAddress, cutoffDate);
    return res.status(200).send({
      message: `request recieved, we will gather transaction data for the provided addresses and email it to: ${emailAddress}`,
      error: false,
    });
  }
  catch (error) {
    return res.status(400).send(getGenericError(error));
  }
});

logger.info('Starting Vidulum Tax Tool');
export default app;
