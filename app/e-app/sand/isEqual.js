// not supported:
//      Buffers
//      Typed arrays
//      functions

// obj is always our VALID solution (no cyclic refs, etc)
const isEqual = function (obj, oth) {
    if (obj === oth) {
        return true;
    }

    const objType = typeof obj;
    const othType = typeof oth;

    if (objType !== othType) {
        return false;
    }

    if (Array.isArray(obj)) {
        const objLength = obj.length;
        const othLength = oth.length;

        if (objLength !== othLength) {
            return false;
        }

        let index = -1;

        while (++index < objLength) {
            if (!isEqual(obj[index], oth[index])) {
                return false;
            }
        }

        return true;
    } else if (objType === 'object') {
        const objKeys = Object.keys(obj);
        const othKeys = Object.keys(oth);
        const objKeysLength = objKeys.length;
        const othKeysLength = othKeys.length;

        if (objKeysLength !== othKeysLength) {
            return false;
        }

        let index = -1;

        while (++index < objKeysLength) {
            const prop = objKeys[index];
            if (!isEqual(obj[prop], oth[prop])) {
                return false;
            }
        }

        return true;
    }

    if (typeof obj === 'number' && isNaN(obj) && isNaN(oth)) {
        return true;
    }

    return (obj === oth);
}

if (module && module.exports) {
    module.exports = isEqual;
}
