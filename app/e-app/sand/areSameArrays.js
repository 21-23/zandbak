// obj is always our VALID SORTED expected array
// oth is always SORTED arrays
const areSameArrays = function (arr, oth, arrLength) {
    if (oth.length !== arrLength) {
        return false;
    }

    let index = -1;

    while (++index < arrLength) {
        if (arr[index] !== oth[index]) {
            return false;
        }
    }

    return true;
};

if (!this.zandbakWorker) {
    module.exports = areSameArrays;
}
