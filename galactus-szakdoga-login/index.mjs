import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const streamToString = (stream) => new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
});

export const handler = async(event) => {
    let { projectName, password } = event;
    
    if (!projectName || !password) {
        const text = Buffer.from(event.body, 'base64');;
        const parsedText = JSON.parse(text);
        projectName = parsedText.projectName;
        password = parsedText.password;    
    }
    
    const client = new S3Client({ config: 'eu-central-1' });
    
    try {
        console.log(`request params: ${JSON.stringify({projectName, password})}`)
        const command = new GetObjectCommand({
            Bucket: 'galactus-szakdoga-users',
            Key: `${projectName}.json`
        });
        const { Body } = await client.send(command);
    
        let result = await streamToString(Body);
        result = JSON.parse(result);
        
        if (result.password !== password) {
            console.log('Returning 403: Wrong project name or password. Please type in your credentials again!')
            return {
                statusCode: 403,
                body: JSON.stringify('Wrong project name or password. Please type in your credentials again!')
            };
        }
        
        console.log('Operation returns successfully')
        return {
            statusCode: 200,
            body: 'OK'
        };
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
};
