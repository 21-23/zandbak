// obj is always our VALID SORTED expected array
// oth is always array that could be sorted by native `sort` (e.g. array of strings)
const areSameArrays = function (arr, oth, arrLength) {
    if (oth.length !== arrLength) {
        return false;
    }

    let index = -1;

    oth.sort();

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
