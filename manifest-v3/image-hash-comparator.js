function compareImageHash(h1, h2) {
    var diffs = 0;
    var histogram = {}
    for (let i = 0; i < 42; i++) {
        histogram[i] = 0;
    }

    for (let i = 0; i < h1.length; i++) {
        var ordI = h1.charCodeAt(i);
        diffs += Math.abs(ordI - h2.charCodeAt(i));

        histogram[ordI - 48] += 1
    }

    var entropy = 0;
    for (let i = 0; i < 42; i++) {
        var p_i = histogram[i] / h1.length;
        if (p_i > 0) {
            entropy += p_i * Math.log2(p_i);
        }
    }
    
    return {
        "diffs": diffs,
        "entropy": -entropy
    };
}