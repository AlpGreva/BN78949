const express = require('express');
const { createCanvas, loadImage, registerFont } = require('canvas');
const csvParser = require('csv-parser');
const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');

// Initialize the express app and set the port
const app = express();
const port = 3000;

// Register the custom font
registerFont(path.join(__dirname, 'fonts', 'Lemon-Regular.ttf'), { family: 'Lemon' });

const wrapTextAndCalculateFontSize = (ctx, text, maxWidth, maxHeight, initialFontSize) => {
    let fontSize = initialFontSize; // Initial font size
    let wrappedText = [];

    // Split the text into words
    const words = text.split(' ');

    // Check if the main text has 4 words or less
    if (words.length <= 4) {
        const joinedText = words.join(' ');
        let lineWidth;

        // Decrease font size until it fits within the maximum width
        while (true) {
            ctx.font = `${fontSize}px Lemon`;
            lineWidth = ctx.measureText(joinedText).width;
            if (lineWidth <= maxWidth || fontSize <= 1) {
                wrappedText.push(joinedText);
                break;
            }
            fontSize--;
        }
    } else {
        // Split the first line into two words
        const firstLine = words.slice(0, 2).join(' ');
        wrappedText.push(firstLine);

        // Wrap the remaining words
        let line = '';
        for (let i = 2; i < words.length; i++) {
            const testLine = line === '' ? words[i] : `${line} ${words[i]}`;
            const lineWidth = ctx.measureText(testLine).width;

            // If adding the current word would exceed the maximum width
            if (lineWidth > maxWidth) {
                wrappedText.push(line);
                line = words[i];
            } else {
                line = testLine;
            }
        }

        // Push the last line
        if (line !== '') {
            wrappedText.push(line);
        }
    }

    // Calculate the total text height
    const totalTextHeight = wrappedText.length * fontSize * 1.2; // Assuming line height is 1.2 times font size

    // Decrease the font size if the total text height exceeds the maximum height
    while (totalTextHeight > maxHeight && fontSize > 1) {
        fontSize--;
    }

    // Return the wrapped text and calculated font size
    return {
        wrappedText,
        fontSize,
    };
};







// Function to read text data from a CSV file at an external URL
const readTextDataFromCSV = async (url) => {
    try {
        // Dynamically import node-fetch
        const { default: fetch } = await import('node-fetch');

        // Fetch CSV data from the external URL
        const response = await fetch(url);

        // Check if the response is successful
        if (!response.ok) {
            throw new Error(`Failed to fetch CSV data: ${response.statusText}`);
        }

        // Parse the CSV data using csv-parser
        const csvData = [];
        const csvStream = response.body.pipe(csvParser());
        return new Promise((resolve, reject) => {
            csvStream
                .on('data', (row) => {
                    csvData.push(row);
                })
                .on('end', () => {
                    resolve(csvData);
                })
                .on('error', (err) => {
                    console.error('Error parsing CSV data:', err);
                    reject(err);
                });
        });
    } catch (err) {
        console.error('Error fetching CSV data:', err);
        throw err;
    }
};

const drawTextGroupWithColorsAndStroke = (ctx, textData, options, width, height, bgColor, textColor, optionColor, lineWidth, strokeStyle) => {
    // Set initial font sizes for different types of text
    const mainTextInitialFontSize = 70; // Initial font size for main text
    const optionInitialFontSize = 40; // Initial font size for options
    const headingInitialFontSize = 45; // Initial font size for "You'll need for this:" heading

    // Set text color
    ctx.fillStyle = textColor;

    // Set stroke properties
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = strokeStyle;

    // Calculate the maximum width for the text (80% of the banner width)
    const maxWidth = width * 0.9;

    // Calculate the maximum height for the text (80% of the canvas height)
    const maxHeight = height * 0.9;

    // Wrap the main text and calculate font size dynamically
    const { wrappedText: mainTextWrapped, fontSize: mainTextFontSize } = wrapTextAndCalculateFontSize(ctx, textData, maxWidth, maxHeight, mainTextInitialFontSize);

    // Calculate the starting vertical position for main text drawing
    const totalMainTextHeight = mainTextWrapped.length * mainTextFontSize * 1.2; // Adjust line height as needed
    const mainTextYStart = height * 0.65; // Position main text at 10% of the total banner height

    // Set text alignment
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Set text shadow properties
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'; // Shadow color (black with lower opacity)
    ctx.shadowBlur = 5; // Shadow blur radius
    ctx.shadowOffsetX = 2; // Horizontal shadow offset
    ctx.shadowOffsetY = 2; // Vertical shadow offset

    // Draw each line of wrapped main text with stroke
    mainTextWrapped.forEach((line, index) => {
        // Set font size for each line
        ctx.font = `${mainTextFontSize}px Lemon`;

        // Calculate Y position for the current line
        const yPos = mainTextYStart + index * mainTextFontSize * 1.2;

        // Draw the text with stroke
        ctx.strokeText(line, width / 2, yPos);
        ctx.fillText(line, width / 2, yPos);
    });

    // Reset shadow properties after drawing the main text
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Set the font size for "You'll need for this:" heading
    ctx.font = `${headingInitialFontSize}px Arial`;

    // Set the color for "You'll need for this:" heading to black by default
    ctx.fillStyle = '#000000';

    // Calculate the starting position for the heading
    let headingYStart = mainTextYStart + totalMainTextHeight + 40; // Add a little padding

    // Draw the heading
    ctx.fillText("You'll need for this:", width / 2, headingYStart);

    // Underline the heading
    const headingWidth = ctx.measureText("You'll need for this:").width;
    ctx.beginPath();
    ctx.moveTo(width / 2 - headingWidth / 2, headingYStart + headingInitialFontSize * 0.6);
    ctx.lineTo(width / 2 + headingWidth / 2, headingYStart + headingInitialFontSize * 0.6);
    ctx.stroke();

    // Set the font size for options
    ctx.font = `${optionInitialFontSize}px Arial`;

    // Calculate the starting position for the options
    let optionsYStart = headingYStart + headingInitialFontSize * 2 + 17; // Add a little space between heading and options lines

    // Set text color for options
    ctx.fillStyle = optionColor;

    // Draw each option line of text without stroke
    options.forEach((option, index) => {
        ctx.fillText(option, width / 2, optionsYStart + index * optionInitialFontSize * 1.1);
    });
};


// Route to generate banners
app.get('/banner', async (req, res) => {
    // Get the URL for the CSV file from the request query
    const csvFileUrl = req.query.csvUrl;

    // Ensure csvUrl is provided by the user
    if (!csvFileUrl) {
        res.status(400).send('CSV URL is required');
        return;
    }

    // Read the text data from the CSV file
    let textData;
    try {
        textData = await readTextDataFromCSV(csvFileUrl);
    } catch (err) {
        console.error('Error reading CSV file:', err);
        res.status(500).send('Error reading CSV file');
        return;
    }

    // Use the text data from the CSV file
    const text = textData[0]?.text || 'Default Text';
    const options = [textData[0]?.option1, textData[0]?.option2, textData[0]?.option3].filter(Boolean);

    // Get other parameters from the request query
    const bgColor = req.query.bgColor || '#ffffff';
    const textColor = req.query.textColor || '#000000';
    const optionColor = req.query.optionColor || '#000000'; // Option text color
    const lineWidth = parseFloat(req.query.lineWidth) || 3; // Line width for text
    const strokeStyle = req.query.strokeStyle || 'black'; // Stroke style for text
    const width = parseInt(req.query.width) || 1080;
    const height = parseInt(req.query.height) || 1350;
    const bgImageUrl = req.query.bgUrl || 'https://i.postimg.cc/Qd01WRnt/zzaz.png'; // URL for the background image https://i.postimg.cc/MTZRxLsy/zzaz.png
    const imgUrl = req.query.imgUrl || ''; // URL for the other image

    // Create a canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Get the scaleFactor from the request query, defaulting to 0.3 if not provided
    const scaleFactor = parseFloat(req.query.scaleFactor) || 0.3;

    // Load the other image from the provided URL
    try {
        if (imgUrl) {
            const { default: fetch } = await import('node-fetch');
            const imageResponse = await fetch(imgUrl);
            const imageArrayBuffer = await imageResponse.arrayBuffer();
            const imageBuffer = Buffer.from(imageArrayBuffer);
            const img = await loadImage(imageBuffer);

            let imgWidth;
            let imgHeight;
            let imgX;
            let imgY;

            // Calculate the dimensions to fit the entire 70% of the canvas size
            const actualScaleFactor = height * 0.7 / img.height;
            imgWidth = img.width * actualScaleFactor * scaleFactor;
            imgHeight = img.height * actualScaleFactor * scaleFactor;

            imgX = (width - imgWidth) / 2; // Center horizontally
            imgY = (height * 0.7 - imgHeight) / 2; // Center vertically

            // Draw the other image
            ctx.drawImage(img, imgX, imgY, imgWidth, imgHeight);
        }
    } catch (error) {
        console.error('Error loading other image:', error);
        res.status(500).send('Error loading other image');
        return;
    }

    // Load the background image from the provided URL
    try {
        if (bgImageUrl) {
            const { default: fetch } = await import('node-fetch');
            const imageResponse = await fetch(bgImageUrl);
            const imageArrayBuffer = await imageResponse.arrayBuffer();
            const imageBuffer = Buffer.from(imageArrayBuffer);
            const bgImage = await loadImage(imageBuffer);
            ctx.drawImage(bgImage, 0, 100, width, height); // Draw the background image
        } else {
            // If no background image URL provided, fill the canvas with the background color
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, width, height);
        }
    } catch (error) {
        console.error('Error loading background image:', error);
        res.status(500).send('Error loading background image');
        return;
    }

    // Draw all text elements with specified colors and stroke properties
    drawTextGroupWithColorsAndStroke(ctx, text, options, width, height, bgColor, textColor, optionColor, lineWidth, strokeStyle);

    // Convert canvas to PNG image and send as a response
    const imageBuffer = canvas.toBuffer('image/png');
    res.setHeader('Content-Type', 'image/png');
    res.send(imageBuffer);
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
