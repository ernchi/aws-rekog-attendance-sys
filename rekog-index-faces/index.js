'use strict';

/* Author: Ern Chi Khoo */

const { addFace, findFace, removeFaceFromCollection } = require('./lib/rekognition');
const { saveToDynamoDB, removeFromDynamoDB } = require('./lib/dynamodb');
const CollectionId = 'COLLECTION_ID';
const TableName = 'TABLE_NAME';
const FaceMatchThreshold = 90;

// Checks if face is already known - if not, enrolls in collection.
// Possible result values:
// - INDEXED: face is successfully indexed.
// - RE-INDEXED: users picture has been replaced and re-indexed
// - NO_FACES: no faces are found in the image.

/**
 * Extracts the username from image file
 * @param {String} filename Name of image file 
 */
function getUsername(filename) {
    var externalId;
    // '@' is encoded as '%40' when passed into lambda function
    if (filename.indexOf('%') > 0) {
        externalId = filename.substring(0, filename.indexOf('%'));
    } else if (filename.indexOf('.') > 0) {
        externalId = filename.substring(0, filename.indexOf('.'));
    } else {
        externalId = filename;
    }
    return externalId;
}

exports.handler = async (event) => {

    const Bucket = event.Records[0].s3.bucket.name;
    const Name = event.Records[0].s3.object.key; // Full image file name 
    var Obj = Name; // Name used to find object in S3
    const ExternalImageId = getUsername(Name); // Get username from image file
    // Check if image file name contains email address 
    if (Name.indexOf('%') > 0) {
        Obj = Name.replace('%40', '@'); // Replace %40 with @ symbol
    }
    console.log(`Started: Bucket=${Bucket}; Name=${Name}`);

    let result = '';
    let findFaceResult = {};

    // Check if face already in the collection
    try {
        findFaceResult = await findFace({
            CollectionId,
            FaceMatchThreshold,
            Image: {
                S3Object: {
                    Bucket,
                    Name: Obj
                }
            },
            MaxFaces: 1
        });
    } catch (err) {
        // Throws error if no faces in the picture - log in DDB and exit
        await saveToDynamoDB({
            TableName,
            Item: {
                imageId: ExternalImageId,
                mode: 'added',
                result: 'NO_FACES',
                rekognition: {}
            }
        });
        return {
            statusCode: 200
        };
    }
    
    // Determine result
    if (findFaceResult.FaceMatches.length > 0) {
        // User is already indexed, replace their photo
        var matchedFace = findFaceResult.FaceMatches[0].Face.ExternalImageId;
        console.log(matchedFace + ' is already in collection: ', findFaceResult.FaceMatches.length);
        var oldFaceId = findFaceResult.FaceMatches[0].Face.FaceId;
        console.log('Replacing image...');
        try {
            // Remove user from rekognition collection 
            await removeFaceFromCollection({
                CollectionId: CollectionId,
                FaceIds: [oldFaceId]
            });
            console.log('Successfully removed: ' + matchedFace);
        } catch (err) {
            console.log('An error occurred: ' + err);
        }
        // Remove user from dynamodb 
        await removeFromDynamoDB({
            TableName,
            Key: {
                'imageId': matchedFace
            }
        });
        // Index new photo into collection
        const addFaceResult = await addFace({
            CollectionId,
            Image: {
                S3Object: {
                    Bucket,
                    Name: Obj
                }
            },
            ExternalImageId,
            DetectionAttributes: ['ALL']
        });
        console.log('Successfully re-indexed: ' + ExternalImageId);
        result = 'RE-INDEXED';
        console.log(JSON.stringify(addFaceResult, null, 2));
        findFaceResult = addFaceResult;
    } else {
        // Index user into rekognition collection 
        const addFaceResult = await addFace({
            CollectionId,
            Image: {
                S3Object: {
                    Bucket,
                    Name: Obj
                }
            },
            ExternalImageId,
            DetectionAttributes: ['ALL']
        });
        result = 'INDEXED';
        console.log(JSON.stringify(addFaceResult, null, 2));
        findFaceResult = addFaceResult;
    }

    // Save Rekognition info to DDB
    console.log('ddbResult: ', await saveToDynamoDB({
        TableName,
        Item: {
            imageId: ExternalImageId,
            mode: 'enroll',
            result,
            rekognition: findFaceResult
        }
    }));
    return {
        statusCode: 200
    };
};
