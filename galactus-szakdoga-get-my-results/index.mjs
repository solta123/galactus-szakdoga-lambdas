import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const streamToString = (stream) => new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
});

const getCookie = (value, name) => {
    const cookieArr = value.split(";");
    
    for (let i = 0; i < cookieArr.length; i++) {
        const cookiePair = cookieArr[i].split("=");
        
        if (name == cookiePair[0].trim()) {
            return decodeURIComponent(cookiePair[1]);
        }
    }
    
    return null;
}

const decodeCookie = (cookie) => {
    if (!cookie) {
        return null;
    }
    const bufferObj = Buffer.from(cookie, 'base64');
    const text = bufferObj.toString("utf-8");
    const { galactusCredentials } = JSON.parse(text);
    const { projectName, password } = JSON.parse(galactusCredentials);
        
    return {
        projectName,
        password
    };
}

export const handler = async(event) => {
    console.log('galactus-szakdoga-get-my-results started running')
    const cookie = getCookie(event.headers.cookie, 'galactusCredentials');
    
    const { projectName, password } = decodeCookie(cookie);
    
    if (!projectName || !password) {
        console.log('Returning 400: Your credentials doesn\'t seem to be provided properly. Please sign in again!')
        return {
            statusCode: 400,
            body: JSON.stringify('Your credentials doesn\'t seem to be provided properly. Please sign in again!')
        }
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
        
        if (result.password !== password) {
            console.log('Returning 403: Password does not match')
            return {
                statusCode: 403,
                body: JSON.stringify('No permission to upload results to this project. Please type in your credentials again!')
            };
        }
        console.log('Successful authentication')
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
    
    try {
        const getCommand = new ListObjectsV2Command({
            Bucket: 'galactus-szakdoga-results',
            Prefix: `${projectName}/`
        });
        const getResult = await client.send(getCommand);
        
        const responsePayload = getResult.Contents.map(file => file.Key.substring(projectName.length + 1));
        
        console.log('Operation returns successfully')
        return {
            statusCode: 200,
            body: JSON.stringify(responsePayload)
        }
    } catch(error) {
        console.log(error)
        
        console.log('Returning 400: Unknown error occured while querying your results!')
        return {
            statusCode: 400,
            body: JSON.stringify('Unknown error occured while querying your results!')
        }
    }

};
