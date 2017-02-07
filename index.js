const log = require('./lib/log')
const express = require('express')
const bodyParser = require('body-parser')

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

function generateResponse(req, res) {
	if (req.body) {
		const text = req.body.text
		if (text) {
			const rx = /(?:ENV|GR|I|R|G|ST|T|TH|E|S|D|TS|TK|AT|RT|RS|RP|EI|PK|RD|FG|B)-\d+/ig
			const matches = text.match(rx)
			if (matches) {
				return res.send(JSON.stringify({ text: matches.join('\n\n') }))
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
