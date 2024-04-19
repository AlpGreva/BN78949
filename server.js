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

// Function to wrap text and calculate font size dynamically
const wrapTextAndCalculateFontSize = (ctx, text, maxWidth, maxHeight) => {
    let fontSize = 50; // Initial font size
    let wrappedText = [];
    let linesCount;

    // Find the appropriate font size that allows the text to fit within the max height
    while (true) {
        ctx.font = `${fontSize}px Lemon`; // Set the font style and size

        const words = text.split(' ');
        let line = '';
        wrappedText = [];

        // Wrap the text based on the max width
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
    const width = parseInt(req.query.width) || 1080;
    const height = parseInt(req.query.height) || 1350;
    const imgUrl = req.query.imgUrl || ''; // URL for the image

    // Create a canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Load the image from the provided URL
    try {
        if (imgUrl) {
            const { default: fetch } = await import('node-fetch');
            const imageResponse = await fetch(imgUrl);
            const imageArrayBuffer = await imageResponse.arrayBuffer();
            const imageBuffer = Buffer.from(imageArrayBuffer);
            const image = await loadImage(imageBuffer);
            ctx.drawImage(image, 0, 0, width, height * 0.67); // Draw the image in the top 2/3 of the canvas
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

    // Wrap the text and calculate font size dynamically
    const { wrappedText, fontSize } = wrapTextAndCalculateFontSize(ctx, text, maxWidth, maxHeight);
	

    // Calculate the starting vertical position for text drawing
    const totalTextHeight = wrappedText.length * fontSize * 1.2; // Adjust line height as needed
    const textYStart = height * 0.67 + (height * 0.33 - totalTextHeight) / 2 - 100 ;

    // Set text alignment
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw each line of wrapped text in the colored rectangle
	wrappedText.sort((a, b) => b.length - a.length); // Sort wrapped text lines in descending order of length

	// Set text shadow properties
	ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'; // Shadow color (black with lower opacity)
	ctx.shadowBlur = 5; // Shadow blur radius (adjusted to a smaller value)
	ctx.shadowOffsetX = 2; // Horizontal shadow offset (adjusted to a smaller value)
	ctx.shadowOffsetY = 2; // Vertical shadow offset (adjusted to a smaller value)

	// Set stroke properties
	ctx.lineWidth = 5; // Stroke line width (adjusted to a smaller value)
	ctx.strokeStyle = 'black'; // Stroke color set to black

	// Draw each line of wrapped text in the colored rectangle
	wrappedText.forEach((line, index) => {
		// Calculate font size for each line
		const lineFontSize = index === 0 ? fontSize * 1.05 : fontSize; // Slightly larger for the first line

		// Set the font size and style for the current line
		ctx.font = `${lineFontSize}px Lemon`;

		// Calculate Y position for the current line
		const yPos = textYStart + index * lineFontSize * 1.2;

		// Draw the text with stroke
		ctx.strokeText(line, width / 2, yPos);

		// Draw the line of text
		ctx.fillText(line, width / 2, yPos);
	});

	// Reset shadow and stroke properties after drawing the text
	ctx.shadowColor = 'transparent';
	ctx.shadowBlur = 0;
	ctx.shadowOffsetX = 0;
	ctx.shadowOffsetY = 0;
	ctx.lineWidth = 1;
	
		// ****************************Calculate the starting position for the static text
	let staticTextYStart = textYStart + totalTextHeight + 20; // Add a little padding

	// Set the font size and style for the static text
	ctx.font = `${fontSize}px Arial`;

	// Draw the static text
	ctx.fillText("You'll need for this:", width / 2, staticTextYStart);

	// Calculate the starting position for the options text
	let optionsTextYStart = staticTextYStart + fontSize * 1.3; // Add a little space between static text and options lines


	// Calculate the starting position for the options text
	//let optionsTextYStart = textYStart + totalTextHeight + 10; // Add a little padding

	// Calculate the font size for options text
	let optionsFontSize = fontSize;
	let maxOptionWidth = options.reduce((maxWidth, option) => Math.max(maxWidth, ctx.measureText(option).width), 0);

	// Resize options font size if needed
	while (maxOptionWidth > maxWidth) {
		optionsFontSize -= 1;
		ctx.font = `${optionsFontSize}px Arial`;
		maxOptionWidth = options.reduce((maxWidth, option) => Math.max(maxWidth, ctx.measureText(option).width), 0);
	}

	// Sort the options in descending order based on the width
	const sortedOptions = options.map(option => ({
		text: option,
		width: ctx.measureText(option).width
	})).sort((a, b) => b.width - a.width);

	// Draw each option line of text in sorted order
	sortedOptions.forEach((option, index) => {
		ctx.font = `${optionsFontSize}px Arial`;
		ctx.fillText(option.text, width / 2, optionsTextYStart + index * optionsFontSize * 1.1);
	});

    // Convert canvas to PNG image and send as a response
    const imageBuffer = canvas.toBuffer('image/png');
    res.setHeader('Content-Type', 'image/png');
    res.send(imageBuffer);
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
