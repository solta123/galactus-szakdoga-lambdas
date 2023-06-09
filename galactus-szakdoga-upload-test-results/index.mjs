import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const streamToString = (stream) => new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
});

export const handler = async(event) => {
    let { projectName, password, testCoverage } = event;
    
    if (!projectName || !password || !testCoverage) {
        const text = Buffer.from(event.body, 'base64');;
        const parsedText = JSON.parse(text);
        projectName = parsedText.projectName;
        password = parsedText.password;
        testCoverage = parsedText.testCoverage;
    }
    
    const client = new S3Client({ config: 'eu-central-1' });
    
    try {
        const command = new GetObjectCommand({
            Bucket: 'galactus-szakdoga-users',
            Key: `${projectName}.json`
        });
        const { Body } = await client.send(command);
        
        let result = await streamToString(Body);
        result = JSON.parse(result);
        
        let dowloadedPassword = result.password;
        if (!dowloadedPassword) {
            const text = Buffer.from(result.body, 'base64');;
            const parsedText = JSON.parse(text);
            dowloadedPassword = parsedText.password;
        }
        
        if (dowloadedPassword !== password) {
            console.log('Returning 403: No permission to upload results to this project. Please type in your credentials again!')
            return {
                statusCode: 403,
                body: JSON.stringify('No permission to upload results to this project. Please type in your credentials again!')
            };
        }
    } catch (error) {
        console.log(error)
        if (error.name === 'AccessDenied') {
            console.log('Returning 403: Project does not exist. Please register one first!')
            return {
                statusCode: 403,
                body: JSON.stringify('Project does not exist. Please register one first!')
            }
        }
        
        console.log('Returning 400: Unkown error occured during authentication')
        return {
            statusCode: 400,
            body: JSON.stringify('Unkown error occured during authentication')
        }
    }
    
    const lambdaClient = new LambdaClient({ region: 'eu-central-1' });
    const uploadCommand = new InvokeCommand({
        FunctionName: 'galactus-szakdoga-function',
        Payload: JSON.stringify({
            projectName,
            testCoverage: { ...testCoverage }
        })
    })
        
    try {
        const uploadResponse = await lambdaClient.send(uploadCommand);
        
        if (uploadResponse.FunctionError === 'Unhandled') {
            console.log('Returning 400: Something went wrong while generating visualization.')
            return {
                statusCode: 400,
                body: JSON.stringify('Something went wrong while generating visualization.')
            }
        }
        
        console.log('Operation returns successfully')
        return {
            statusCode: 200,
            body: JSON.stringify('Upload was successful!')
        };
    } catch(error) {
        console.log(error);
        console.log('Returning 400: Unkown error occured during result upload.')
        return {
            statusCode: 400,
            body: JSON.stringify('Unkown error occured during result upload.')
        }
    }
};
