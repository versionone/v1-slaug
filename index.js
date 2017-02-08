"use strict";

const log = require('./lib/log')
const express = require('express')
const bodyParser = require('body-parser')

const recentlyMentioned = new Set()

function processingTimer(req, res, next) {
	const start = Date.now()
	res.on('finish', () => log('response', Date.now() - start))
	next()
}

const parseBody = [
	bodyParser.json({ strict: false }),
	bodyParser.urlencoded({ extended: false }),
	bodyParser.text({ type: '*/*' }),
]

function logRequest(req, res, next) {
	log('request', req.method, req.originalUrl, req.get('Content-Type'), JSON.stringify(req.body))
	next()
}

const notRecentlyMentioned = (key) => !recentlyMentioned.has(key)

const formatResponse = (key) => `${key} looks like an asset number`

function generateResponse(req, res) {
	if (req.body) {
		const requestText = req.body.text
		if (requestText) {
			const rx = /(?:ENV|GR|I|R|G|ST|T|TH|E|S|D|TS|TK|AT|RT|RS|RP|EI|PK|RD|FG|B)-\d+/ig
			let matches = requestText.match(rx)
			if (matches) {
				matches = matches.filter(notRecentlyMentioned)
				const responses = []
				for (let i = 0; i < matches.length; ++i) {
					const id = matches[i]
					responses.push(formatResponse(id))
					recentlyMentioned.add(id)
					setTimeout(() => recentlyMentioned.delete(id), 120 * 1000)
				}
				const responseText = responses.join('\n')
				return res.send(JSON.stringify({ text: responseText }))
			}
		}
	}
	res.end()
}

const app = express();
app.use(
	processingTimer,
	parseBody,
	logRequest,
	generateResponse
)

function start(app, port) {
	app.set('port', port);
	app.listen(port, log.defer('listening', port))
}

start(app, process.env.PORT || 61525)
