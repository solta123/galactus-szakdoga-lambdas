import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const streamToString = (stream) => new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
});

export const handler = async(event) => {
    let { projectName, password } = event;
    console.log(JSON.stringify(event))
    
    const buff = new Buffer(event.body, 'base64');
    const text = buff.toString('ascii');
    const parsedText = JSON.parse(text);
    projectName = parsedText.projectName;
    password = parsedText.password;
    console.log(JSON.parse(text))
    
    if (!projectName || !password) {
        const params = JSON.parse(event.body);
        projectName = params.projectName;
        password = params.password;
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
        
        console.log(`result: ${JSON.stringify(result)}`)
        
        if (result.password !== password) {
            return {
                statusCode: 403,
                body: JSON.stringify('Wrong project name or password. Please type in your credentials again!')
            };
        }
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': `galactusCredentials=${JSON.stringify({ projectName, password })}; Max-Age=36000; Secure; HttpOnly; SameSite=None; Path=/`
            },
            body: 'OK'
        };
    } catch (error) {
        console.log(error)
        if (error.name === 'AccessDenied') {
            return {
                statusCode: 403,
                body: JSON.stringify('Project does not exist. Please register one first!')
            }
        }
        
        return {
            statusCode: 400,
            body: JSON.stringify('Unkown error occured during authentication')
        }
    }
};
