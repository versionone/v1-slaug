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
	 res.send("Hello")
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
