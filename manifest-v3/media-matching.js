"use strict";

const MAX_MATCH_DISTANCE = 8;

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

    let naturalImageElement = document.createElement("img");
    naturalImageElement.setAttribute("crossorigin", "Anonymous");

    if (!imageElement.complete || imageElement.naturalHeight === 0) {
        await loadImage(imageElement);
    }

    await loadImage(naturalImageElement, imageElement.src);
    return await matchLoadedMedia(naturalImageElement);
}

function matchResult(label) {
    return {
        match: true,
        label: label
    }
}

async function preprocessForHashing(imageElement) {
    // Check if it looks like a mobile screenshot
    
}

async function matchLoadedMedia(imageElement) {
    const preprocessedImageElement = await preprocessForHashing(imageElement);
    const hash = await phash(imageElement);
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