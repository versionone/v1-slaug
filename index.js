const log = require('./lib/log')
const express = require('express')
const bodyParser = require('body-parser')

const parseBody = [
	bodyParser.json({ strict: false }),
	bodyParser.urlencoded({ extended: false }),
	bodyParser.text({ type: '*/*' }),
]

const logRequest = (req, res, next) => {
	log('request', req.method, req.originalUrl, req.get('Content-Type'), JSON.stringify(req.body))
	next()
}

const dummyResponse = (req, res) => { res.send("Hello") }

const app = express();
app.use(parseBody, logRequest, dummyResponse)

function start(app, port) {
	app.set('port', port);
	app.listen(port, log.defer('listening', port))
}

start(app, process.env.PORT || 61525)
