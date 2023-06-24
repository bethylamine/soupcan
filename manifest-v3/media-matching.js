"use strict";

const MAX_MATCH_DISTANCE = 8;

function createCanvas(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

async function createAndLoadImg(src) {
    const imgEl = document.createElement("img");
    imgEl.setAttribute("crossorigin", "Anonymous");
    await loadImage(imgEl, src);
    return imgEl;
}

function noMatch() {
    return {
        match: false
    }
}

async function loadImage(img, src = null) {
    return new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;

        if (src) {
            img.src = src
        }
    });
}

async function matchMedia(imageElement) {
    if (!database || !database["media_matching_data"]) {
        return noMatch();
    }

    if (!imageElement.complete || imageElement.naturalHeight === 0) {
        await loadImage(imageElement);
    }

    return await matchLoadedMedia(imageElement);
}

function matchResult(label) {
    return {
        match: true,
        label: label
    }
}

function cropForMobile(canvas) {
    let portraitRatio = canvas.height / canvas.width;
    if (portraitRatio > 1.7 && portraitRatio < 2.2) {
        // Use a smaller canvas for checking
        const SMALL_CANVAS_WIDTH = Math.min(128, canvas.width);

        let smallCanvas = createCanvas(SMALL_CANVAS_WIDTH, Math.floor(SMALL_CANVAS_WIDTH * portraitRatio));
        const sCtx = smallCanvas.getContext("2d", {willReadFrequently: true});
        sCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);

        // Grab pixel data
        let imageData = sCtx.getImageData(0, 0, smallCanvas.width, smallCanvas.height).data;

        let row = 0;
        let col = 0
        let solidPixelsInRow = 0;
        let solidRows = [];
        let rowColor = -1;

        // Scan for solid rows down the image
        for(let i = 0; i < imageData.length; i += 4) {
            if (solidPixelsInRow >= 0) {
                const red = imageData[i];
                const green = imageData[i + 1];
                const blue = imageData[i + 2];
                const alpha = imageData[i + 3];

                let newRowColor = red + green + blue + alpha;

                if (rowColor < 0) {
                    rowColor = newRowColor;
                } else {
                    if (Math.abs(newRowColor - rowColor) < 30) {
                        rowColor = newRowColor;
                        solidPixelsInRow++;
                    } else {
                        solidPixelsInRow = -1;
                    }
                }
            }

            col++;
            if (col >= smallCanvas.width) {
                if (solidPixelsInRow > Math.floor(SMALL_CANVAS_WIDTH * 0.9)) {
                    solidRows.push(row);
                }

                col = 0;
                row++;
                solidPixelsInRow = 0;
            }
        }

        // Determine the ratio of solid borders to solid center rows
        let solidBorders = 0;
        let solidCenters = 0;

        for (let y = 0; y < Math.floor(smallCanvas.height * 0.25); y++) {
            if (solidRows.includes(y)) {
                solidBorders++;
            }
        }
        for (let y = Math.floor(smallCanvas.height * 0.75); y < smallCanvas.height; y++) {
            if (solidRows.includes(y)) {
                solidBorders++;
            }
        }
        for (let y = Math.floor(smallCanvas.height * 0.25); y < Math.floor(smallCanvas.height * 0.75); y++) {
            if (solidRows.includes(y)) {
                solidCenters++;
            }
        }

        if (solidRows.length > Math.floor(smallCanvas.height * 0.1) && solidBorders > solidCenters * 3) {
            // detected screenshot, find inside image boundaries
            let topVal = 0;
            for (let y = 0; y < solidRows.length - 1; y++) {
                if (solidRows[y + 1] < solidRows[y] + Math.floor(SMALL_CANVAS_WIDTH / 10)) {
                    topVal = y + 1;
                } else {
                    break;
                }
            }

            let topRow = solidRows[topVal];

            let botVal = 0;
            let botRow = Math.floor(smallCanvas.height) - topRow;

            if (solidRows.includes(Math.floor(smallCanvas.height) - 1)) {
                for (let y = solidRows.length - 1; y > 1; y--) {
                    if (solidRows[y - 1] > solidRows[y] - Math.floor(SMALL_CANVAS_WIDTH / 5)) {
                        botVal = y - 1;
                    } else {
                        break;
                    }
                }
                botRow = solidRows[botVal];
            }

            let hScaleFactor = (canvas.height / smallCanvas.height);
            let newHeight = Math.floor((botRow - topRow) * hScaleFactor);

            let originalCanvas = canvas;
            canvas = createCanvas(canvas.width, newHeight);
            const newCtx = canvas.getContext("2d", {willReadFrequently: true});
            newCtx.drawImage(originalCanvas, 0, -Math.floor(topRow * hScaleFactor));
        }

    }
    
    return canvas;
}

async function preprocessForHashing(imageElement) {
    // Create canvas for image processing
    let canvas = createCanvas(imageElement.naturalWidth, imageElement.naturalHeight);

    // Fill the canvas black
    const ctx = canvas.getContext("2d", {willReadFrequently: true});
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the image on top
    ctx.drawImage(imageElement, 0, 0);

    // Check if it's a mobile screenshot, and if so, crop it
    canvas = cropForMobile(canvas);

    // Create and load an image element to return
    return createAndLoadImg(canvas.toDataURL());
}

async function matchLoadedMedia(domImgElement) {
    // Hold image in hidden element
    let imageElement = await createAndLoadImg(domImgElement.src);

    const preprocessedImageElement = await preprocessForHashing(imageElement);
    const hash = await phash(preprocessedImageElement);
    const hashHex = hash.toHexString();

    if (hashHex in database["media_matching_data"]) {
        // Cache hit
        return matchResult(database["media_matching_data"][hashHex]);
    } else {
        // Compute Hamming distances and find close matches
        for (let dbHashHex in database["media_matching_data"]) {
            const dbHash = ImageHash.fromHexString(dbHashHex)
            const distance = dbHash.hammingDistance(hash);

            if (distance <= MAX_MATCH_DISTANCE) {
                // Found a match
                return matchResult(database["media_matching_data"][dbHashHex])
            } 
        }
        return noMatch();
    }
}