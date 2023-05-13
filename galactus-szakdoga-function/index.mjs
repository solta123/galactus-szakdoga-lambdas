import https from "https";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import * as d3 from 'd3';
import { JSDOM } from 'jsdom'
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

global.document = new JSDOM('').window.document;

function put(url, data) {
    return new Promise((resolve, reject) => {
        const req = https.request(
            url,
            { method: "PUT", headers: { "Content-Length": new Blob([data]).size } },
            (res) => {
            let responseBody = "";
            res.on("data", (chunk) => {
                responseBody += chunk;
            });
            res.on("end", () => {
                console.log('asdasd end')
                console.log(responseBody)
                resolve(responseBody);
            });
            }
        );
        req.on("error", (err) => {
            console.log('asdasd error')

            console.log(err)
            reject(err);
        });
        req.write(data);
        req.end();
    });
}

const createPresignedUrlWithClient = ({ region, bucket, key }) => {
    const client = new S3Client({ region });
    const command = new PutObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(client, command, { expiresIn: 3600 });
};

export const handler = async (event) => {
    console.log(JSON.stringify(event))
    const drawTestShape = (polygons) => {
        const htmlContentDiv = document.createElement('div');
        htmlContentDiv.id = 'html-content';
        document.body.append(htmlContentDiv);

        const vis = d3.select(htmlContentDiv).append("svg")
                .attr("width", 700)
                .attr("height", 500),
            scaleX = d3.scaleLinear()
                .domain([0, 30])
                .range([0, 100]),
            scaleY = d3.scaleLinear()
                .domain([30, 0])
                .range([100, 0]),
            poly = polygons;

        if (polygons.length < 1) {
            vis.append("text")
                .attr("x", MIDDLE_X)
                .attr("y", 100)
                .attr("font-size", "32")
                .text("No testing data was found");
        } else {
            vis.selectAll("polygon")
                .data(poly)
                .enter()
                .append("polygon")
                .attr("points", function (d) {
                    return d.points.map(function (d) {
                        return [scaleX(d.x), scaleY(d.y)].join(",");
                    }).join(" ");
                })
                .attr("stroke", "#666")
                .attr("stroke-width", 2)
                .attr("fill", "gray");

            document.querySelectorAll("polygon").forEach((polygon, i) => polygon.style.fill = colorsArray[i]);

            const legend = vis.append("g")
                .attr("class", "legend")
                .attr("height", 100)
                .attr("width", 100)
                .attr('transform', 'translate(10,20)');

            legend.selectAll('rect')
                .data(polygons)
                .enter()
                .append("rect")
                .attr("x", 2)
                .attr("y", function (d, i) {
                    return i * 20;
                })
                .attr("width", 10)
                .attr("height", 10)
                .style("fill", function (d) {
                    return colors[d.name];
                });

            legend.selectAll('text')
                .data(polygons)
                .enter()
                .append("text")
                .attr("x", 15)
                .attr("y", function (d, i) {
                    return i * 20 + 9;
                })
                .text(function (d) {
                    return d.name
                });
        }
    }

    const MIDDLE_X = 80;

    const colors = {
        unit: '#F47174',
        component: 'lightblue',
        integration: '#EEEE9B',
        e2e: 'lightgreen'
    }

    const arrayOfInputs = [];
    const colorsArray = [];
    const testCases = [];

    Object.keys(event.testCoverage).forEach(testCase => {
        if (event.testCoverage[testCase] > 0) {
            arrayOfInputs.push(event.testCoverage[testCase]);
            colorsArray.push(colors[testCase]);
            testCases.push(testCase);
        }
    });

    if (arrayOfInputs.length < 1) {
        drawTestShape([])
    } else if (arrayOfInputs.length < 2) {
        const arrayOfPolygons = [
            {
                name: testCases[0],
                points: [
                    {x: 30, y: 0},
                    {x: 30, y: 100},
                    {x: 130, y: 100},
                    {x: 130, y: 0}
                ]
            }
        ];

        drawTestShape(arrayOfPolygons);
    } else {
        const maxInput = Math.max(...arrayOfInputs);

        const levelDiff = 100 / arrayOfInputs.length;

        const arrayOfMiddlePointRanges = arrayOfInputs.map(input => input / maxInput * 35);

        const blockBorders = [];
        for (let i = 0; i < arrayOfInputs.length - 1; i++) {
            const diff = (arrayOfMiddlePointRanges[i + 1] - arrayOfMiddlePointRanges[i]) / 2;
            blockBorders.push(arrayOfMiddlePointRanges[i] + diff)
        }

        const restOfOuterPolygon = (middlePoint, outerPoint = 0, higher = false) => {
            const lowerBorder = (middlePoint - outerPoint) + middlePoint;

            if (lowerBorder < 0) {
                const lowerBorderHeight = outerPoint * 12.5 / ((MIDDLE_X + outerPoint) - (MIDDLE_X + middlePoint));
                return [
                    {x: MIDDLE_X, y: higher ? levelDiff - lowerBorderHeight : 100 - levelDiff + lowerBorderHeight}
                ];
            }

            const middleHeight = higher ? 0.5 * levelDiff : 100 - (0.5 * levelDiff);
            const outerHeight = higher ? 0 : 100
            return [
                {x: MIDDLE_X + middlePoint, y: middleHeight},
                {x: MIDDLE_X + lowerBorder, y: outerHeight},
                {x: MIDDLE_X - lowerBorder, y: outerHeight},
                {x: MIDDLE_X - middlePoint, y: middleHeight},
            ]
        };

        const firstPolygon = [
            {x: MIDDLE_X - blockBorders[0], y: 100 - levelDiff},
            {x: MIDDLE_X + blockBorders[0], y: 100 - levelDiff},
            ...restOfOuterPolygon(arrayOfMiddlePointRanges[0], blockBorders[0])
        ];

        const middlePolygons = [];
        for (let i = 0; i < arrayOfInputs.length - 2; i++) {
            middlePolygons.push({
                name: testCases[i + 1],
                points: [
                    {x: MIDDLE_X - blockBorders[i], y: 100 - ((i + 1) * levelDiff)},
                    {x: MIDDLE_X - arrayOfMiddlePointRanges[i + 1], y: 100 - (i + 1.5) * levelDiff},
                    {x: MIDDLE_X - blockBorders[i + 1], y: 100 - (i + 2) * levelDiff},
                    {x: MIDDLE_X + blockBorders[i + 1], y: 100 - (i + 2) * levelDiff},
                    {x: MIDDLE_X + arrayOfMiddlePointRanges[i + 1], y: 100 - (i + 1.5) * levelDiff},
                    {x: MIDDLE_X + blockBorders[i], y: 100 - ((i + 1) * levelDiff)}
                ]
            });
        }

        const arrayOfPolygons = [
            {
                name: testCases[0],
                points: [...firstPolygon]
            },
            ...middlePolygons,
            {
                "name": testCases[testCases.length - 1],
                "points": [
                    {x: MIDDLE_X - blockBorders[blockBorders.length - 1], y: levelDiff},
                    {x: MIDDLE_X + blockBorders[blockBorders.length - 1], y: levelDiff},
                    ...restOfOuterPolygon(
                        arrayOfMiddlePointRanges[arrayOfMiddlePointRanges.length - 1],
                        blockBorders[blockBorders.length - 1],
                        true
                    )
                ]
            }
        ];

        drawTestShape(arrayOfPolygons);
    }

    try {
        const currentDate = new Date().toJSON();
        const filename = `${event.projectName}/${event.projectName}_${currentDate}.html`
        const clientUrl = await createPresignedUrlWithClient({
            region: 'eu-central-1',
            bucket: 'galactus-szakdoga-results',
            key: filename,
        });

        await put(clientUrl, document.getElementById('html-content').innerHTML.toString());

        console.log('Operation returns successfully')
        return {
            statusCode: 200,
            body: 'success'
        };
    } catch (error) {
        console.log(error)
        console.log('Returnung 400: Error while uploading generated file.')
        return {
            statusCode: 400,
            body: 'Error while uploading generated file.'
        };
    }
    
}
