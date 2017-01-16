exports.log = (...args) => {
    console.log(`[${Date.now()}]`, ...args);
};
exports.warn = (...args) => {
    console.warn(`[${Date.now()}]`, ...args);
};
exports.error = (...args) => {
    console.error(`[${Date.now()}]`, ...args);
};
