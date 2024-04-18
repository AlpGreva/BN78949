const express = require('express');
const { createCanvas, loadImage } = require('canvas');
const csvParser = require('csv-parser');
const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

const wrapTextAndDrawOptions = (ctx, text, options, maxWidth, maxHeight, width, height) => {
    // Wrap the main text and calculate font size
    const { wrappedText, fontSize } = wrapTextAndCalculateFontSize(ctx, text, maxWidth, maxHeight);
    
    // Calculate the starting position for the main text
    const totalTextHeight = wrappedText.length * fontSize * 1.2; // Adjust line height as needed
    const textYStart = height * 0.67 + (height * 0.33 - totalTextHeight) / 2 - 20; // Move main text up by 20px
    
    // Set text alignment
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw each line of wrapped text in the colored rectangle
    wrappedText.forEach((line, index) => {
        // Calculate font size for each line
        const lineFontSize = index === 0 ? fontSize * 1.1 : fontSize;

        // Set the font size and style for the current line
        ctx.font = `${lineFontSize}px Lemon`;

        // Calculate Y position for the current line
        const yPos = textYStart + index * lineFontSize * 1.2;

        // Draw the line of text
        ctx.fillText(line, width / 2, yPos);
    });
    
    // Calculate the starting Y position for the options
    let optionsYStart = textYStart + totalTextHeight + fontSize * 1.2;

    // Predefined font size for option lines
    const optionFontSize = 30;

    // Draw each option line
    options.forEach((option, index) => {
        // Set the font size and style for the option line
        ctx.font = `${optionFontSize}px Lemon`;
        
        // Wrap the option text and calculate font size dynamically
        const { wrappedText: wrappedOptionText, fontSize: optionFontSize } = wrapTextAndCalculateFontSize(ctx, option, maxWidth, maxHeight);

        // Check if option exceeds 80% of the banner width
        if (ctx.measureText(option).width > maxWidth * 0.8) {
            // Resize font size to fit within 80% of the banner width
            ctx.font = `${optionFontSize}px Lemon`;
        }

        // Calculate Y position for the current option line
        const optionYPos = optionsYStart + index * (optionFontSize * 1.2);
        
        // Draw the option text
        ctx.fillText(option, width / 2, optionYPos);
    });
};


// Function to wrap text based on a given width and calculate font size
const wrapTextAndCalculateFontSize = (ctx, text, maxWidth, maxHeight) => {
    let fontSize = 50; // Initial font size
    let wrappedText = [];
    let linesCount;

    // Find the appropriate font size that allows the text to fit within the max height
    while (true) {
        // Set the font size and style
        ctx.font = `${fontSize}px Lemon`;

        // Split the text into words
        const words = text.split(' ');
        let line = '';
        wrappedText = [];

        // Wrap the text
        for (let i = 0; i < words.length; i++) {
            const testLine = line + (line === '' ? '' : ' ') + words[i];
            const lineWidth = ctx.measureText(testLine).width;

            // If the line width exceeds the maximum width, start a new line
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

        // Calculate the total height of the wrapped text
        const lineHeight = fontSize * 1.2; // Adjust line height as needed
        linesCount = wrappedText.length;
        const totalTextHeight = linesCount * lineHeight;

        // Check if the total text height is within the maximum height
        if (totalTextHeight <= maxHeight) {
            break; // Found a suitable font size
        }

        // Decrease the font size and retry
        fontSize -= 1;
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
        const fetch = (await import('node-fetch')).default;

        // Fetch CSV data from the external URL
        const response = await fetch(url);

        // Check if the response is not successful
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

    // Extract the main text and options from the CSV data
    const text = textData[0]?.text || 'Default Text';
    const options = [
        textData[0]?.option1 || '',
        textData[0]?.option2 || '',
        textData[0]?.option3 || ''
    ];

    // Get other parameters from the request query
    const bgColor = req.query.bgColor || '#ffffff';
    const textColor = req.query.textColor || '#000000';
    const width = parseInt(req.query.width) || 1000;
    const height = parseInt(req.query.height) || 1500;
    const imgUrl = req.query.imgUrl || ''; // URL for the image

    // Create a canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Load the image from the provided URL
    try {
        if (imgUrl) {
            const fetch = (await import('node-fetch')).default;
            const imageResponse = await fetch(imgUrl);
            const imageArrayBuffer = await imageResponse.arrayBuffer();
            const imageBuffer = Buffer.from(imageArrayBuffer);
            const image = await loadImage(imageBuffer);
            ctx.drawImage(image, 0, 0, width, height * 0.67); // 2/3 image height
        }
    } catch (error) {
        console.error('Error loading image:', error);
        res.status(500).send('Error loading image');
        return;
    }

    // Draw the colored rectangle
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, height * 0.67, width, height * 0.33);

    // Set text color
    ctx.fillStyle = textColor;

    // Calculate the maximum width for the text (80% of the banner width)
    const maxWidth = width * 0.8;

    // Calculate the maximum height for the text (80% of the rectangle height)
    const maxHeight = height * 0.33 * 0.8;

    // Call the function to wrap the main text and draw options
    wrapTextAndDrawOptions(ctx, text, options, maxWidth, maxHeight, width, height);

    // Convert canvas to PNG image and send as a response
    const imageBuffer = canvas.toBuffer('image/png');
    res.setHeader('Content-Type', 'image/png');
    res.send(imageBuffer);
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
