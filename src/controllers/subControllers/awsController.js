/* eslint-disable no-bitwise */
import logger from 'npmlog';
import aws from 'aws-sdk';
import dotenv from 'dotenv';
import { createMIMEMessageFromURI, createMIMEMessageFromFile } from '../../utils/utilities.js';

dotenv.config();

const env = process.env.NODE_ENV || 'development';
const MIN_UPLOAD_SIZE = 5 * 1024 * 1024;

export const REQUEST_STATUS = {
  PENDING: 'pending-requests',
  COMPLETED: 'completed-requests',
  FAILED: 'failed-requests',
};
// let uploadData = '';
export class AWSController {
  constructor() {
    this.uploadMap = new Map();
    this.partMap = new Map();
    this.region = process.env.REGION;
    this.sourceEmail = process.env.SOURCE_EMAIL;
    this.accessKeyId = process.env.ACCESS_KEY;
    this.secretAccessKey = process.env.SECRET_KEY;
    this.bucketName = process.env.BUCKET_NAME;
    this.requestTableName = process.env.REQUEST_TABLE_NAME;
    this.awsConfig = {
      region: this.region,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
    };
    if (env !== 'local' && (!this.accessKeyId || !this.secretAccessKey || !this.sourceEmail)) {
      logger.error('Missing AWS credentials. Exiting...');
      process.exit(1);
    }
    this.s3 = new aws.S3(this.awsConfig);
    this.ses = new aws.SES(this.awsConfig);
    this.dynamodb = new aws.DynamoDB(this.awsConfig);
    this.eventBridge = new aws.EventBridge(this.awsConfig);

    this.uploadData = [];
  }

  // S3 upload handler
  async startMultiPartUpload(directory, filename) {
    const key = `${directory}/${filename}`;
    try {
      const res = await this.s3.createMultipartUpload({ Bucket: this.bucketName, Key: key, ACL: 'public-read' }).promise();
      const { error, UploadId } = res;
      if (error) {
        logger.error('Error starting multipart upload:', res.error);
        logger.error('ERROR Exiting application...');
        process.exit(1);
      }
      else {
        this.uploadMap.set(UploadId, 1);
        logger.info('Creating Multipart Upload. uploadId:', UploadId);
        return UploadId;
      }
    } catch (err) {
      logger.error('Error starting multipart upload:', err);
      logger.error('ERROR Exiting application...');
      process.exit(1);
    }
    return null;
  }

  async abortUpload(key, uploadId) {
    logger.warn('Aborting Upload:', uploadId);
    const params = {
      Bucket: this.bucketName, /* required */
      Key: key, /* required */
      UploadId: uploadId, /* required */
    };
    try {
      await this.s3.abortMultipartUpload(params).promise();
    } catch (err) {
      logger.error('Error aborting multipart upload:', err);
      logger.error('ERROR Exiting application...');
      process.exit(1);
    }
  }

  async completeMultipartUpload(directory, filename, uploadId) {
    const key = `${directory}/${filename}`;
    const parts = this.partMap.has(uploadId) ? this.partMap.get(uploadId) : [];

    try {
      if (parts.length) {
        parts.sort((a, b) => a.PartNumber - b.PartNumber);
        if (this.uploadData.length) {
          const finalUpload = await this.uploadPart(key, uploadId);
          logger.info('Final part upload:', finalUpload);
        }
        const params = {
          Bucket: this.bucketName, /* required */
          Key: key, /* required */
          UploadId: uploadId, /* required */
          // ChecksumCRC32: 'STRING_VALUE',
          // ChecksumCRC32C: 'STRING_VALUE',
          // ChecksumSHA1: 'STRING_VALUE',
          // ChecksumSHA256: 'STRING_VALUE',
          // ExpectedBucketOwner: 'STRING_VALUE',
          MultipartUpload: {
            Parts: parts,
          },
          // RequestPayer: requester,
          // SSECustomerAlgorithm: 'STRING_VALUE',
          // SSECustomerKey: Buffer.from('...') || 'STRING_VALUE' /* Strings will be Base-64 encoded on your behalf */,
          // SSECustomerKeyMD5: 'STRING_VALUE',
        };
        logger.info('Attempting to complete Upload:');
        const result = await this.s3.completeMultipartUpload(params).promise();
        logger.info(`Successfully close multipart Upload: ${uploadId} data:`, result.Location); // successful response
        this.uploadMap.delete(uploadId);
        this.partMap.delete(uploadId);
        const URI = result.Location;
        logger.info('URI:', URI);
        return URI;
        /*
          result = {
            Bucket: "acexamplebucket",
            ETag: "\"4d9031c7644d8081c2829f4ea23c55f7-2\"",
            Key: "bigobject",
            Location: "https://examplebucket.s3.<Region>.amazonaws.com/bigobject"
          }
      */
      }

      await this.abortUpload(key, uploadId);
      const params = {
        Bucket: this.bucketName, /* required */
        Key: key,
        Body: this.uploadData.join(''),
        ACL: 'public-read',
      };
      const result = await this.s3.upload(params).promise();
      const URI = result.Location;
      return URI;
    }
    catch (err) {
      const {
        code, region: rgn, time, requestId, extendedRequestId, statusCode, message,
      } = err;
      const errmsg = {
        message, code, statusCode, requestId, extendedRequestId, region: rgn, time,
      };
      logger.error('Error completing multipart upload:', errmsg);
      logger.error('Aborting MultiPart Upload...');

      await this.abortUpload(key, uploadId);
      logger.info('Aborted MultiPart Upload:', uploadId);
    }
    return null;
  }

  async uploadPart(key, uploadId, tryNum = 0) {
    const partNum = this.uploadMap.has(uploadId) ? this.uploadMap.get(uploadId) : 1;
    const partParams = {
      Body: this.uploadData.join(''),
      Bucket: this.bucketName,
      Key: key,
      PartNumber: partNum,
      UploadId: uploadId,
    };
    const maxTries = 3;
    tryNum++;
    try {
      const result = await this.s3.uploadPart(partParams).promise();
      logger.info('Successfully uploaded part: #', partParams.PartNumber);
      this.uploadMap.set(uploadId, partNum + 1);
      const part = {
        ETag: result.ETag,
        PartNumber: partParams.PartNumber,
      };
      let parts = [];
      if (this.partMap.has(uploadId)) {
        parts = this.partMap.get(uploadId);
      }
      parts.push(part);
      this.partMap.set(uploadId, parts);
      this.uploadData.splice(0, this.uploadData.length); // We uploaded successfully so clear the Buffer
      return uploadId;
    } catch (err) {
      logger.error('multiErr, upload part error:', err);
      if (tryNum <= maxTries) {
        logger.info('Retrying upload of part: #', partParams.PartNumber);
        return this.uploadPart(key, uploadId, tryNum);
      }
      logger.error('Error uploading part: #', partParams.PartNumber);
      logger.error('ERROR Exiting application...');
      await this.abortUpload(key, uploadId);
      process.exit(1);
    }
    return null;
  }

  async uploadToS3(directory, filename, data, uploadId) {
    const key = `${directory}/${filename}`;
    if (!this.uploadData.length && !this.partMap.has(uploadId)) {
      const columns = [
        'Date', 'Sent Amount', 'Sent Currency',
        'Received Amount', 'Received Currency',
        'Fee Amount', 'Fee Currency',
        'Net Worth Amount', 'Net Worth Currency',
        'Label', 'Description', 'TxHash',
      ].join(',');
      this.uploadData.push(columns);
    }
    this.uploadData.push(data);
    if (this.isMinimumUploadSize()) {
      logger.info('Uploading part for uploadId:', uploadId);
      await this.uploadPart(key, uploadId);
    }
    return uploadId;
  }

  isMinimumUploadSize() {
    const dataSize = Buffer.from(this.uploadData.join('')).length;
    const isMinimumUploadSize = dataSize >= MIN_UPLOAD_SIZE;
    logger.info(`Data size: ${dataSize} bytes, minimum size: ${MIN_UPLOAD_SIZE} bytes, Should Upload:`, isMinimumUploadSize);
    return isMinimumUploadSize;
  }

  // SES email handler

  async emailHandler(recipient, mailContent) {
    const params = {
      Destinations: [recipient],
      RawMessage: { /* required */
        Data: mailContent,
      },
    };
    try {
      const result = await this.ses.sendRawEmail(params).promise();
      logger.info(`Email sent to '${recipient}' successfully. MessageId:`, result.MessageId); // successful response
      return result;
    }
    catch (err) {
      logger.error(err, err.stack); // an error occurred
      return null;
    }
  }

  async sendEmail(emailAddress, body, subject = 'Crypto Transaction Report', filename) {
    const mailContent = createMIMEMessageFromFile(emailAddress, subject, body, filename, this.sourceEmail);

    logger.info(`Sending email to ${emailAddress}, Subject: ${subject}, Attachment:${filename}, Body:`, body);
    return this.emailHandler(emailAddress, mailContent);
  }

  async sendS3Email(emailAddress, body, subject = 'Crypto Transaction Report', filename, uri) {
    const mailContent = createMIMEMessageFromURI(emailAddress, subject, body, filename, uri, this.sourceEmail);

    logger.info(`Sending email to ${emailAddress}, Subject: ${subject}, Attachment:${filename}, Body:`, body);
    return this.emailHandler(emailAddress, mailContent);
  }

  // EventBridge handler

  async writeStartTaskEvent() {
    const baseEvent = { 'event-name': 'Start Tax-App' };
    const params = {
      Entries: [ /* required */
        {
          Detail: JSON.stringify(baseEvent),
          DetailType: 'Start Tax-App',
          EventBusName: 'default',
          Source: 'Tax-App-Lambda',
          Time: new Date(),
        },
      ],
    };
    logger.info('Writing Start Task Event');
    const response = await this.eventBridge.putEvents(params).promise();
    logger.info('Start Task Event written successfully. Response:', response);
  }

  // DynamoDB handler

  async addRequestToStatus(guid, objectName) {
    logger.info('Adding request to status:', objectName);
    let requestList = await this.read({ id: objectName });
    if (!requestList.length) {
      requestList = [guid];
    } else {
      requestList.push(guid);
    }
    await this.write({ id: objectName, value: requestList });
  }

  async getNextPendingRequest() {
    let guid = '';
    try {
      const pendingRequests = await this.read({ id: REQUEST_STATUS.PENDING });
      if (pendingRequests.length > 0) {
        logger.info(`Found ${pendingRequests.length} pending requests.`);
        guid = pendingRequests.shift();
        await this.write({ id: REQUEST_STATUS.PENDING, value: pendingRequests });
        return guid;
      }
      throw new Error('No pending requests');
    }
    catch (error) {
      logger.error('Failed to get next pending request. Error:', error.message);
    }
    return guid;
  }

  async read(event, table = this.requestTableName) {
    let data = null;
    const params = {
      TableName: table,
      Key: {
        id: { S: event.id },
      },
    };
    logger.info('Read from DynamoDB.');
    const result = await this.dynamodb.getItem(params).promise();
    if (!result.Item) {
      switch (event.id) {
        case REQUEST_STATUS.PENDING:
        case REQUEST_STATUS.COMPLETED:
        case REQUEST_STATUS.FAILED:
          data = [];
          break;
        default:
          data = {};
          break;
      }
    }
    else {
      data = JSON.parse(result.Item.value.S);
    }
    logger.info('Read from DynamoDB, succesfully. Data:', data); /* TODO: remove data from log */
    return data;
  }

  async write(event, table = this.requestTableName) {
    logger.info('Writing to DynamoDB');
    const params = {
      TableName: table,
      Item: {
        id: { S: event.id },
        value: { S: JSON.stringify(event.value) },
      },
    };
    const result = await this.dynamodb.putItem(params).promise();
    logger.info('Wrote to DynamoDB, succesfully');
    return result;
  }
}

export default AWSController;
