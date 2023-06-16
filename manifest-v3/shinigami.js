"use strict";

function fnv_1a(v, seed) {
    var a = 2166136261 ^ (seed || 0);
    for (var i = 0, n = v.length; i < n; ++i) {
        var c = v.charCodeAt(i), d = c & 0xff00;
        if (d)
            a = fnv_multiply(a ^ d >> 8);
        a = fnv_multiply(a ^ c & 0xff);
    }
    return fnv_mix(a);
}


function fnv_multiply(a) {
    return a + (a << 1) + (a << 4) + (a << 7) + (a << 8) + (a << 24);
}

function fnv_mix(a) {
    a += a << 13;
    a ^= a >>> 7;
    a += a << 3;
    a ^= a >>> 17;
    a += a << 5;
    return a & 0xffffffff;
}

class BloomFilter {
    // Creates a new bloom filter.  If *m* is an array-like object, with a length
    // property, then the bloom filter is loaded with data from the array, where
    // each element is a 32-bit integer.  Otherwise, *m* should specify the
    // number of bits.  Note that *m* is rounded up to the nearest multiple of
    // 32.  *k* specifies the number of hashing functions.
    constructor(m, k) {
        var a;
        if (typeof m !== "number")
            a = m, m = a.length * 32;
        var n = Math.ceil(m / 32), i = -1;
        this.m = m = n * 32;
        this.k = k;
        var buckets = this.buckets = new Int32Array(n);
        if (a)
            while (++i < n)
                buckets[i] = a[i];
        this._locations = new Uint32Array(new ArrayBuffer(4 * k));
    }

    locations(v) {
        var k = this.k, m = this.m, r = this._locations, a = fnv_1a(v), b = fnv_1a(v, 1576284489), // The seed value is chosen randomly
        x = a % m;
        for (var i = 0; i < k; ++i) {
            r[i] = x < 0 ? (x + m) : x;
            x = (x + b) % m;
        }
        return r;
    }
    ;
    add(v) {
        var l = this.locations(v + ""), k = this.k, buckets = this.buckets;
        for (var i = 0; i < k; ++i)
            buckets[Math.floor(l[i] / 32)] |= 1 << (l[i] % 32);
    }
    ;
    test(v) {
        var l = this.locations(v + ""), k = this.k, buckets = this.buckets;
        for (var i = 0; i < k; ++i) {
            var b = l[i];
            if ((buckets[Math.floor(b / 32)] & (1 << (b % 32))) === 0) {
                return false;
            }
        }
        return true;
    }
    ;
}

class CombinedBloomFilter {
    static getIdForPart(v, i) {
        return i == 0 ? v : v + '|' + i;
    }
    test(screenName) {
        let v = "twitter.com/" + screenName.toLowerCase();
        for (let i = 0; i < this.parts.length; i++) {
            const part = this.parts[i];
            var id = CombinedBloomFilter.getIdForPart(v, i);
            if (part.test(id))
                return true;
        }
        return false;
    }
}

const shinigami = new CombinedBloomFilter();
shinigami.parts = [];
for (let bloomFilter of SHINIGAMI_EYES_TRANSPHOBE_BLOOM_FILTERS) {
    shinigami.parts.push(
        new BloomFilter(bloomFilter["buckets"], bloomFilter["k"])
    );
};