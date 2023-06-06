function compareImageHash(h1, h2) {
    var diffs = 0;
    for (let i = 0; i < h1.length; i++) {
        diffs += Math.abs(h1.charCodeAt(i) - h2.charCodeAt(i));
    }
    return diffs;
}