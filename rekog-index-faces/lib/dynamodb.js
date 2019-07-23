/* Functions used in index.js */

'use strict';

const AWS = require('aws-sdk');
//AWS.config.update({ region: process.env.REGION || 'ap-northeast-1' });
const ddb = new AWS.DynamoDB.DocumentClient();

const saveToDynamoDB = async (params) => {
    console.log('saveToDynamoDB called: ', params);
    return new Promise((resolve, reject) => {
        ddb.put(params, function (err, data) {
            if (err) {
                console.error('saveToDynamoDB', err);
                reject(err);
            } else {
                console.log('saveToDynamoDB: ', data);
                resolve(data);
            }
        });
  });
};

const removeFromDynamoDB = async (params) => {
    console.log('removeFromDB called: ', params);
    return new Promise((resolve,reject) => {
        ddb.delete(params, function (err, data) {
            if (err) {
                console.error('removeFromDB', err);
                reject(err);
            } else {
                console.log('removeFromDB: ', data);
                resolve(data);
            }
        })
    })
}

module.exports = { saveToDynamoDB, removeFromDynamoDB };
