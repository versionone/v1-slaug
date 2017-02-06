"use strict";

var DateTime = require('./datetime')

const slice = Array.prototype.slice
const consoleLog = console.log

function _log(args) {
	const now = new DateTime().toString();
	args.unshift(now)
	consoleLog.apply(console, args)
}

module.exports = function log() {
	_log(slice.call(arguments))
}

module.exports.defer = function defer() {
	const args = slice.call(arguments)
	return function() { _log(args) }
}