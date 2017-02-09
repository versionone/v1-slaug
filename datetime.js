"use strict";

function pad2(n) {
	return (n < 10 ? '0' : '') + n
}

function pad3(n) {
	return (n < 100 ? n < 10 ? '00' : '0' : '') + n
}

function pad4(n) {
	return (n < 1000 ? n < 100 ? n < 10 ? '000' : '00' : '0' : '') + n
}

function DateTime(date, time) {
	if (date instanceof Date) {
		this.date = date
	}
	else {
		switch (typeof date) {
			case 'number':
				this.date = new Date(date)
				break
			case 'string':
				this.date = new Date(date + (typeof time === 'string' ? 'T' + time : '') + 'Z')
				break
			case 'undefined':
				this.date = new Date()
				break
			default:
				throw new TypeError('new DateTime(): with invalid parameter')
		}
	}

	if (isNaN(this.date.valueOf()))
		throw new RangeError(`invalid DateTime: ${date} ${time}`)
}

const rx = /Y+|M+|D+|H+|m+|s+|S+|[^YMDHmsS]+/g

function parse(format) {
	const tokens = []
	let result
	while ((result = rx.exec(format)) !== null)
		tokens.push(result[0])
	return tokens
}

const formatTokens = {
	YYYY: 'YYYY',
	MM: 'MM',
	DD: 'DD',
	HH: 'HH',
	mm: 'mm',
	ss: 'ss',
	SSS: 'SSS',
}

function generateFormatter(format) {
	const tokens = parse(format)
	const replacements = []

	for (let index = 0, len = tokens.length; index < len; ++index) {
		const token = tokens[index]
		if (formatTokens[token]) {
			replacements.push({ index, token })
		}
	}

	return dt => {
		for (let i = replacements.length; i > 0;) {
			const replace = replacements[--i]
			tokens[replace.index] = dt[replace.token]
		}
		return tokens.join('')
	}
}

const formatters = new Map()

function getFormatter(format) {
	let formatter = formatters.get(format)
	if (!formatter)
		formatters.set(format, formatter = generateFormatter(format))
	return formatter
}

const defaultFormat = 'YYYY-MM-DD HH:mm:ss'

DateTime.prototype = {
	get value() { return this.date.getTime() },
	get YYYY() { return pad4(this.date.getUTCFullYear()) },
	get MM() { return pad2(this.date.getUTCMonth() + 1) },
	get DD() { return pad2(this.date.getUTCDate()) },
	get HH() { return pad2(this.date.getUTCHours()) },
	get mm() { return pad2(this.date.getUTCMinutes()) },
	get ss() { return pad2(this.date.getUTCSeconds()) },
	get SSS() { return pad3(this.date.getUTCMilliseconds()) },

	toJSON: function toJSON() { return this.date.toISOString() },

	toString: function toString(format) {
		return getFormatter(format || defaultFormat)(this)
	}
}

module.exports = DateTime