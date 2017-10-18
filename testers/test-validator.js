const assert = require('assert');

const esprima = require('../app/validators/esprima');
const bannedChars = require('../app/validators/banned-chars');

// #region esprima

const esprimaTestData = [
    ['map()', true],
    ['map', true],
    ['map(', false],
    ['map().filter', true],
    ['.map().filter', false],
    ['map().filter.', false],
    ['map((a) => { return a; })', true],
    ['map(() => { return a; })', true],
    ['map(() => { return a })', true],
    ['map(function () { return a; })', true],
    ['map(function () => { return a })', false],
    ['map(function () => return a })', false],
    ['map(function () => { return a )', false],
];

esprimaTestData.forEach((testInput) => {
    if (testInput[1]) {
        assert.equal(esprima.validate(testInput[0]), null, testInput[0]);
    } else {
        assert.ok(esprima.validate(testInput[0]), testInput[0]);
    }
});

console.log('✅  [esprima] Passed');

// #endregion esprima

// ------------------------------------------------------------------------------------------------

// #region banned-chars

const bannedCharsTestData = [
    [{ options: { filler: { bannedCharacters: ['a', 'b'] } } }, [
        ['.select', true],
        ['.select .child div', true],
        ['*', true],
        ['.selact', false],
        ['.selebt', false],
        ['a .select', false],
        ['.select b', false],
        ['.select ⛱', true],
    ]],
    [{ options: { filler: { bannedCharacters: [] } } }, [
        ['.select', true],
        ['*', true],
        ['.select div', true],
        ['a > b', true],
        ['span ~~ p', true],
    ]],
    [{ options: { filler: { bannedCharacters: ['.', '~', '\\', '|', '>', '+', '*', ' '] } } }, [
        ['select', true],
        ['div p', false],
        ['.select', false],
        ['select ~ div', false],
        ['a \\ div', false],
        ['p | div', false],
        ['p > div', false],
        ['p /~ div', false],
        ['p + div', false],
        ['a * span', false],
    ]],
];

bannedCharsTestData.forEach((testInput) => {
    const filler = testInput[0];

    testInput[1].forEach((input) => {
        if (input[1]) {
            assert.equal(bannedChars.validate(input[0], filler), null, input[0]);
        } else {
            assert.ok(bannedChars.validate(input[0], filler), input[0]);
        }
    });
});

console.log('✅  [banned-chars] Passed');

// #endregion banned-chars
