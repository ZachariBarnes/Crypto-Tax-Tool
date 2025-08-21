/* eslint-disable no-restricted-syntax */
import got from 'got';
import logger from 'npmlog';
import dotenv from 'dotenv';
import {
  startVDLLoadingSpinner, startLoadingSpinner, endLoadingSpinner,
  generateUUID, generateFileName,
} from '../utils/utilities.js';
import AWSController, { REQUEST_STATUS } from './subControllers/awsController.js';
import { configMap } from '../configs/coinConfigs.js';
import * as exporter from '../utils/transactionExporter.js';

const MAX_TRANSACTIONS_IN_MEMORY = 50000;

dotenv.config();
const env = process.env.NODE_ENV || 'development';

export class ProcessingController {
  constructor() {
    this.awsController = new AWSController();
  }

  async ValidateAddress(address, coinSymbol) {
    logger.info(`Validating address: ${address} for coin: `, coinSymbol);
    try {
      if (!configMap.has(coinSymbol)) {
        logger.error(`Failed to Find Transactions for address. Error: No config found for Symbol ${coinSymbol}`);
        return false;
      }
      const coinConfig = configMap.get(coinSymbol);
      coinConfig.updateWallet(address, coinSymbol);
      const url = coinConfig.verifyAddressUrl;
      // logger.info('Calling url: ', url);
      const response = await got(url);
      // logger.info('Response: ', response.body);
      if (response.statusCode === 200) {
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to validate address. Error:', error.message);
      return false;
    }
  }

  async lookupAndProcessPendingRequests() {
    logger.info('Looking up pending requests from DynamoDB...');
    const guid = await this.awsController.getNextPendingRequest();
    if (guid) {
      logger.info('Found Pending Request: ', guid);
      try {
        const request = await this.awsController.read({ id: guid });
        logger.info('Processing request: ', guid);
        await this.createAndSendTransactionHistoryForAllAddresses(request.addresses, request.emailAddress, request.cutoffDate, guid);
        logger.info('Finished processing request: ', guid);
        process.exit(0);
      } catch (error) {
        await this.awsController.addRequestToStatus(guid, REQUEST_STATUS.FAILED);
        logger.error('Failed to lookup and process pending requests. Error:', error.message);
        const body = `Failed to process request: ${guid}. Error: ${error.message}`;
        this.awsController.sendEmail(this.awsController.sourceEmail, body, 'Vidulum Tax Tool Error');
        process.exit(1);
      }
    }
    else {
      logger.error('Failed to lookup and process pending requests. Error: No guid found');
      process.exit(0);
    }
  }

  async createAndSendTransactionHistoryForAllAddresses(addresses, email, cutOffDate, uuid) {
    const startTime = new Date();
    const errors = [];
    const directory = uuid || generateUUID();
    const filename = generateFileName();
    let uploadID;
    const startUploadResponse = await this.awsController.startMultiPartUpload(directory, filename);
    if (startUploadResponse) {
      uploadID = startUploadResponse;
    }
    if (uploadID) {
      try {
        logger.warn('Upload Identifier:', uploadID);
        let total = 0;

        for (const wallet of addresses) {
          const { coinSymbol, walletAddress } = wallet;
          logger.info(`Preparing to process Address: ${walletAddress} For Coin: ${coinSymbol}`);
          const result = await this.getAndUploadTransactionHistory(walletAddress, coinSymbol, email, cutOffDate, directory, filename, uploadID);
          const {
            error, totalTxCount,
          } = result;
          logger.info(`Added ${totalTxCount} transactions to Buffer/Upload`);
          total += totalTxCount;

          if (error) {
            logger.info('tx count on Error:', totalTxCount);
            const msg = `Unable to get transactions for address: ${walletAddress} and symbol: ${coinSymbol}, since:${cutOffDate}.
              Is there transaction history available?\n`;
            logger.error(msg);
            if (totalTxCount <= 0) // don't add to error list if there are transactions
              errors.push(msg);
          }
        }

        const URI = await this.awsController.completeMultipartUpload(directory, filename, uploadID);
        const errorString = errors.length ? `The following errors Occured:\n ${JSON.stringify(errors, null, 2)}\n` : '';
        const body = `Your Crypto Transaction report requestId id: ${uuid}\n
          ${errorString}\nTransaction History Attached in file ${filename}.\n
          Total Transactions: ${total}`;
        const subject = 'Vidulum Tax tool Transaction History';
        await this.awsController.sendS3Email(email, body, subject, filename, URI);
        const endTime = new Date();
        logger.info(`Total Time Taken: ${(endTime - startTime) / 1000 / 60} minutes`);
        logger.info(`successfully processed transactions for user ${email} at timestamp:`, new Date().toISOString());
        await this.awsController.addRequestToStatus(uuid, REQUEST_STATUS.COMPLETED);
        process.exit(0);
      } catch (error) {
        // Close upload request on failure
        logger.error('Failed to create CSV file. Error:', error);
        await this.awsController.completeMultipartUpload(directory, filename, uploadID);
        const endTime = new Date();
        logger.info(`Total Time Taken: ${(endTime - startTime) / 1000 / 60} minutes`);
        logger.error(`Failed to process transactions for user ${email} at timestamp:`, new Date().toISOString());
        await this.awsController.addRequestToStatus(uuid, REQUEST_STATUS.FAILED);
        process.exit(1);
      }
    }
  }

  async getAndUploadTransactionHistory(address, coinSymbol, email, cutOffDate, directory, filename, uploadId) {
    let spinnerID = false;
    let totalTxCount = 0;
    let allTransactions = [];
    if (!configMap.has(coinSymbol)) {
      logger.error(`Failed to Find Transactions for address. Error: No config found for Symbol ${coinSymbol}`);
      allTransactions = [];
      totalTxCount = 0;
      return false;
    }
    const coinConfig = configMap.get(coinSymbol);
    if (cutOffDate) {
      cutOffDate = new Date(cutOffDate);
    }
    logger.info(`Creating transaction history for address: ${address} symbol: ${coinSymbol} email: ${email} cutoffdate: ${cutOffDate || null}`);
    try {
      coinConfig.updateWallet(address, coinSymbol);
      const url = coinConfig.transactionUrl;
      logger.info('Calling url: ', url);
      // logger.info('search Params: ', coinConfig.searchParams);
      let totalPages = Infinity; // There should be at least one page in which case this number will be updated
      const iterator = got.paginate.each(url, {
        searchParams: coinConfig.searchParams,
        pagination: {
          transform: (response) => {
            const { transactions, requestLimit } = coinConfig.transformResponse(response);
            totalPages = requestLimit;
            allTransactions.push(...transactions);
            return transactions;
          },
          paginate: (response, allItems, currentItems) => coinConfig.paginate(response, allItems, currentItems),
          shouldContinue: (item, allItems, currentItems) => coinConfig.shouldContinue(item, allItems, currentItems, cutOffDate),
          countLimit: totalPages,
        },
      });

      if (env === 'development' || env === 'local') {
        spinnerID = startVDLLoadingSpinner();
      } else {
        spinnerID = startLoadingSpinner();
      }
      for await (const res of iterator) {
        await res;
        if (allTransactions.length > MAX_TRANSACTIONS_IN_MEMORY) {
          const uploadCount = await this.uploadBatchTransactions(allTransactions, totalTxCount, directory, filename, uploadId);
          logger.info(`Added ${uploadCount} transactions to Buffer/Upload`);
          allTransactions = allTransactions.slice(uploadCount + 1);
          totalTxCount += uploadCount;
          // logger.info('New transaction Length:', allTransactions.length);
        }
      }
      if (allTransactions.length > 0) {
        const uploadCount = await this.uploadBatchTransactions(allTransactions, totalTxCount, directory, filename, uploadId);
        allTransactions = allTransactions.slice(uploadCount + 1);
        totalTxCount += uploadCount;
        logger.info(`Added ${uploadCount} transactions to Buffer/Upload`);
        // logger.info('New transaction Length:', allTransactions.length);
      }
      // Stop the spinner
      if (spinnerID) {
        endLoadingSpinner(spinnerID, env === 'development');
        spinnerID = undefined;
      }
      coinConfig.cleanUp();
      return { filename, totalTxCount };
    } catch (error) {
      logger.error('Failed while finding Transactions for address. Error:', error);
      if (spinnerID) {
        endLoadingSpinner(spinnerID, env === 'development');
        spinnerID = undefined;
      } coinConfig.cleanUp();
      await this.uploadBatchTransactions(allTransactions, totalTxCount, directory, filename, uploadId);
      return { error: [error.message], filename, totalTxCount };
    }
  }

  async uploadBatchTransactions(transactions, totalTxCount, directory, filename, uploadId) {
    const txCount = transactions.length;
    await this.uploadTransactions(transactions, filename, directory, uploadId);
    // splice transaction to shallow copy instead of resetting array
    logger.info(`Uploaded ${txCount} transactions to CSV/Buffer for file:`, filename);
    totalTxCount += txCount;
    logger.info('Running Total Tranasaction Count:', totalTxCount);
    return txCount;
  }

  async uploadTransactions(transactions, filename, directory, uploadId) {
    try {
      const csv = await exporter.SaveKoinlyCsv(transactions, filename, uploadId);
      if (!filename || !csv) {
        throw new Error('Failed to create CSV data');
      }
      await this.awsController.uploadToS3(directory, filename, csv, uploadId);
      return filename;
    } catch (error) {
      logger.error('Failed to create CSV file. Error:', error);
      return false;
    }
  }
}

export default ProcessingController;
