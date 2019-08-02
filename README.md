# aws-rekog-attendance-sys
Facial recognition based attendance taking system using AWS Rekognition. 

## Background 
During my internship, I was tasked with creating an attendance taking system utilizing facial recognition technology for our company's technology division's Townhall Event. So, we used various AWS Services and an open source android app (to host the video stream). 

### Event Flow
1. Attendees will first have to register themselves for the event through the Company Employee App. 
2. They can also change their company profile picture to a more updated, current photo of themselves through the app. 
3. On the day of the event, attendees will simply have to walk past the cameras set up that host the video stream. 
4. If they were successfully identified, they will receive a push notification from the app saying that their attendance has been taken. 

### How It Works
1. The database of all employee photos are uploaded into an S3 bucket which triggers the index-faces Lambda function.
2. All photos will be indexed into the Rekognition collection. 
3. If they change their photo through the Company Employee App, the previous photo in the Rekognition collection will be replaced with the new photo.
4. When the video stream runs on event day, AWS Kinesis will produce a data stream which triggers the other Lambda function. 
5. AWS Rekognition will detect the faces that are captured in the video stream.
6. The Lambda function will call an API to register the attendees and send them push notifications. 

### Other Features
1. The photo in the rekognition collection will be changed when the attendee changes their profile picture in the app
2. The Lambda function will cross check with a DynamoDB table to see if a person has already attended, which prevents the API being called many times 
