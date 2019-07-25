'use strict';

var AWS = require('aws-sdk');
var request = require('request');
var dynamodb = new AWS.DynamoDB();
const tableName = 'TABLE_NAME'; // DynamoDB table to record attendance

const eventId = 'EVENT_ID';
const sessionId = 'SESSION_ID';

// Authorization token for API 
const tokenUserProfile = 'TOKEN'; 
const tokenMarkAttendance = 'TOKEN';

// URL for API
var host = 'HOST';
var getUserApiURL = host + 'URL';
var markAttendanceApiURL = host + 'URL' + eventId + '/sessions/' + sessionId + '/scans';

var unknownCount = 0; // Number of unknown faces

/**
 * Retrieves user's ID from within the database by providing email. 
 * @param {String} email User's email address
 */
function getUserProfileByEmail(email) {
    return new Promise((resolve, reject) => {
        const params = {
            uri: getUserApiURL + email,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + tokenUserProfile
            },
        };
        var result = '';
        request(params, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                result = body;
                var json = JSON.parse(result);
                console.log('------success: API 1--------', json);
                const idStr = json.id;
                resolve(idStr);
            } else {
                console.log('------error: API 1------', error);
                reject('Error obtaining user profile.');
            }
        });
    });
}

/**
 * Marks attendance of user and sends them a push notification.
 * @param {String} userId User's id number
 */
function markAttendance(userId) {
    return new Promise((resolve, reject) => {
        var body = {};
        body.userId = userId;
        const jsonStr = JSON.stringify(body);
        const params = {
            uri: markAttendanceApiURL,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': tokenMarkAttendance
            },
            body: jsonStr
        };
        var result = '';
        request(params, function (error, response, body) {
            if (!error && (response.statusCode >= 200 && response.statusCode < 300)) {
                result = body;
                console.log('------success: API 2--------', result);
                resolve(true);
            } else {
                console.log('------error: API 2------', error);
                reject(false);
            }
        });
    });
}

/**
 * Adds user to dynamodb attendance list. 
 * @param {String} userId User's id number
 * @param {String} externalId User's company username
 * @param {String} eventId Event id number
 * @param {String} sessionId Event session id number
 * @param {String} tableName DynamoDB table to record attendance
 */
function register(userId, externalId, eventId, sessionId, tableName) {
    return new Promise((resolve, reject) => {
        const params = {
            Item: {
                "UserId": {
                    "S": userId
                },
                "ExternalId": {
                    "S": externalId
                },
                "EventId": {
                    "S": eventId
                },
                "SessionId": {
                    "S": sessionId
                }
            },
            TableName: tableName
        };
        dynamodb.putItem(params, function (err, data) {
            if (err) reject(err);
            else resolve("Successfully registered: " + userId);
        });
    });
}

/**
 * Checks if the user has registered for the event, by searching dynamodb. 
 * Returns true if user has already registered, else returns false. 
 * @param {String} userId User's id number
 * @param {String} tableName DynamoDB table to record attendance
 */
function alreadyRegistered(userId, tableName) {
    return new Promise((resolve, reject) => {
        const params = {
            Key: {
                "UserId": {
                    "S": userId
                }
            },
            TableName: tableName
        };
        dynamodb.getItem(params, function (err, data) {
            if (err) reject(err);
            else if (Object.keys(data).length != 0) resolve(true);
            else resolve(false);
        });
    });
}

/**
 * Increases the counter for number of unknown persons detected within this stream. 
 * @param count Current number of unknown people detected
 */
function updateUnknownCounter(count) {
    count = count.toString();
    return new Promise((resolve, reject) => {
        const params = {
            Item: {
                "Id": {
                    "S": "EVENT_NAME"
                },
                "Count": {
                    "N": count
                }
            },
            TableName: "TABLE_NAME"
        };
        dynamodb.putItem(params, function (err, data) {
            if (err) reject(err);
            else resolve("Counter updated.");
        });
    });
}

/**
 * If there are multiple faces that match the user, sort the faces and return 
 * the face that has the highest similarity to the user.
 * @param {Array} faces Faces that match the user
 */
function getHighestConfidence(faces) {
    faces.sort(function(face1, face2) {
        return face1.Similarity > face2.Similarity;
    });
    return faces[0];
}

exports.handler = (event, context, callback) => {
    event.Records.forEach((record) => {
        const load = new Buffer(record.kinesis.data, 'base64').toString('ascii');
        const payload = JSON.parse(load);
        // Recieved response from payload
        if (payload.FaceSearchResponse != null) {
            payload.FaceSearchResponse.forEach(async (face) => {
                try {
                    // Found a face match, check if it has been identified before
                    if (face.MatchedFaces != null && Object.keys(face.MatchedFaces).length > 0) {
                        var matchedFace = getHighestConfidence(face.MatchedFaces);
                        var externalId = matchedFace.Face.ExternalImageId;
                        var email = externalId + "@EMAIL";
                        // Call API to retrieve user id number from database
                        var userId = await getUserProfileByEmail(email);
                        console.log("Checking for attendance...");
                        // Checks if user has registered. If not, register them by marking their attendance and sending them a push notification
                        if (await alreadyRegistered(userId, tableName)) console.log(externalId + " has already registered.");
                        else {
                            await register(userId, externalId, eventId, sessionId, tableName);
                            console.log("Registered: " + externalId);
                            if (await markAttendance(userId)) console.log("Attendance has been marked.");
                        }
                    } else {
                        // Cannot find match, update counter
                        unknownCount++;
                        console.log("Unknown person detected."); 
                        await updateUnknownCounter(unknownCount);
                    }
                } catch (err) {
                    console.log("An error occurred: " + err);
                }
            });
        } else console.log("Could not detect any faces.");
    });
};
