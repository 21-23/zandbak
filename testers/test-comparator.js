const assert = require('assert');

const _isEqual = require('lodash.isequal'); // eslint-disable-line import/no-extraneous-dependencies

const { hrtimeToMs } = require('../app/helpers');

const isEqual = require('../app/e-app/sand/isEqual');

const testData = [
    [null, null, true],
    [null, NaN, false],
    [NaN, NaN, true],
    [0, -0, true],
    [false, false, true],
    [false, null, false],
    [undefined, false, false],
    [1, '1', false],
    [null, 'null', false],
    [[1], [1], true],
    [[1], [2], false],
    [[1], [1, 2], false],
    [[1, true], [1, true], true],
    [[1, true, NaN], [1, true, NaN], true],
    [[1, undefined, NaN], [1, undefined, NaN], true],
    [{ a: 1 }, { a: 1 }, true],
    [{ a: 1 }, { a: 1, b: 2 }, false],
    [{ a: 1, b: null }, { a: 1, b: undefined }, false],
    [{ a: [1, false] }, { a: [1, false] }, true],
    [{ a: [1, NaN], b: { ba: 'null', bb: false } }, { a: [1, NaN], b: { ba: 'null', bb: false } }, true],
    [{ a: [1, NaN], b: { ba: 'null', bb: [false] } }, { a: [1, NaN], b: { ba: 'null', bb: false } }, false],
];

testData.forEach((testInput) => {
    const obj = testInput[0];
    const oth = testInput[1];
    const expected = testInput[2];

    assert.equal(isEqual(obj, oth), _isEqual(obj, oth), JSON.stringify(testInput));
    assert.equal(isEqual(obj, oth), expected, `Expected mismatch: ${JSON.stringify(testInput)}`);
});


let uTestResult = null;
let uTestStart = null;
let uTestEnd = null;
const testDataCopy = JSON.parse(JSON.stringify(testData));
const testDataCopyCopy = JSON.parse(JSON.stringify(testData));

assert.equal(isEqual(testDataCopy, testDataCopyCopy), true, 'Uber test failed');
assert.equal(_isEqual(testDataCopy, testDataCopyCopy), true, 'Uber test failed');

uTestStart = process.hrtime();
uTestResult = isEqual(testData, testDataCopy);
uTestEnd = process.hrtime(uTestStart);
console.log('comparator uTest:', hrtimeToMs(uTestEnd));
assert.equal(uTestResult, false, 'Uber test failed');


uTestStart = process.hrtime();
uTestResult = _isEqual(testData, testDataCopy);
uTestEnd = process.hrtime(uTestStart);
console.log('_.isEqual uTest:', hrtimeToMs(uTestEnd));
assert.equal(uTestResult, false, 'Uber test failed');


console.log('✅  Passed');
