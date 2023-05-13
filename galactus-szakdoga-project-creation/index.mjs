import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

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
        const command = new GetObjectCommand({
            Bucket: 'galactus-szakdoga-users',
            Key: `${projectName}.json`
        });
        await client.send(command);
        
        console.log('Returning 400: ProjectName already exists. Please use a unique identifier!')
        return {
            statusCode: 400,
            body: JSON.stringify('ProjectName already exists. Please use a unique identifier!')
        };
    } catch (error) {
        const putCommandInput = {
          "Body": JSON.stringify(event),
          "Bucket": "galactus-szakdoga-users",
          "Key": `${projectName}.json`
        };
        const putCommand = new PutObjectCommand(putCommandInput);
        const putResponse = await client.send(putCommand);
        console.log(putResponse)
        
        console.log('Operation returns successfully')
        return {
            statusCode: 200,
            body: JSON.stringify('Registration was successful!')
        };
    }
};
