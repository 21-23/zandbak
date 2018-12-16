const assert = require('assert');

const esprima = require('../app/validators/esprima');
const bannedChars = require('../app/validators/banned-chars');
const acorn = require('../app/validators/acorn');

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

// ------------------------------------------------------------------------------------------------

// #region acorn

const acornTestData = [
    ['return arg.map(a => a.name)', true],
    ['return;', true],
    ['arg.filter(a => a)', true],
    ['returnr arg.map(a => a.name)', false],
    ['.map().filter', false],
    ['let const = var;', false],
    ['const c = 1; let l = 2; var v = 3; return c + l + v;', true],
    ['const c = 1; let l = 2; var v = 3; c = 4; return c + l + v;', true],
    ['function fn() { return fn;', false],
    ['function fn() { return fn(); } return fn;', true],
];

acornTestData.forEach((testInput) => {
    if (testInput[1]) {
        assert.equal(acorn.validate(testInput[0]), null, testInput[0]);
    } else {
        assert.ok(acorn.validate(testInput[0]), testInput[0]);
    }
});

console.log('✅  [acorn] Passed');

// #endregion acorn
