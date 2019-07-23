/* Functions used by index.js*/

'use strict';

const AWS = require('aws-sdk');
AWS.config.update({ region: process.env.REGION || 'ap-northeast-1' });
const rekognition = new AWS.Rekognition();

const addFace = async (params) => {
    console.log('addFace called: ', params);
    return new Promise((resolve, reject) => {
        rekognition.indexFaces (params, function (err, data) {
            if (err) {
                console.error('addFace error: ', err);
                reject(err);
            }
            else {
                console.log('addFace complete: ', data);
                resolve(data);
            }
        });  
    });
};

const findFace = async (params) => {
    console.log('searchFacesByImage called: ', params);
    return new Promise((resolve, reject) => {
        rekognition.searchFacesByImage (params, function (err, data) {
            if (err) {
                console.error('findFace error: ', err);
                reject(err);
            }
            else {
                console.log('findFace complete: ', data);
                resolve(data);
            }
        });    
    });
};

const removeFaceFromCollection = async (params) => {
    console.log("removeFaceFromCollection called: ", params);
    return new Promise((resolve, reject) => {
        rekognition.deleteFaces (params, function(err, data) {
            if (err) {
                console.log('removeFace error: ', err);
                reject(err);
            } else {
                console.log('removeFace complete: ', data);
                resolve(data);
            }
        })
    })
}

module.exports = { addFace, findFace, removeFaceFromCollection };
