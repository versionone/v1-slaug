"use strict";

const log = require('./lib/log')
const express = require('express')
const bodyParser = require('body-parser')

const _recentlyExpanded = new Set()
const isRecentlyExpanded = (key) => _recentlyExpanded.has(key.toLowerCase())
const rememberExpanded = (key) => {
	key = key.toLowerCase()
	_recentlyExpanded.add(key)
	setTimeout(() => _recentlyExpanded.delete(key), 120 * 1000)
}

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


const assettypeMap = {
	at: ['Test', 'BaseAsset'],
	b: ['Story', 'BaseAsset'],
	d: ['Defect', 'BaseAsset'],
	e: ['Epic', 'BaseAsset'],
	//ei: ['ExternalActionInvocation', 'ExternalActionInvocation'],
	env: ['Environment', 'Environment'],
	fg: ['Theme', 'BaseAsset'],
	g: ['Goal', 'BaseAsset'],
	//gr: ['Grant', 'Grant'],
	i: ['Issue', 'BaseAsset'],
	pk: ['Bundle', 'BaseAsset'],
	r: ['Request', 'BaseAsset'],
	//r: ['Story', 'BaseAsset'],
	rd: ['Roadmap', 'BaseAsset'],
	rp: ['RegressionPlan', 'BaseAsset'],
	rs: ['RegressionSuite', 'BaseAsset'],
	rt: ['RegressionTest', 'BaseAsset'],
	s: ['Story', 'BaseAsset'],
	st: ['StrategicTheme', 'BaseAsset'],
	t: ['Topic', 'BaseAsset'],
	th: ['Theme', 'BaseAsset'],
	tk: ['Task', 'BaseAsset'],
	ts: ['TestSet', 'BaseAsset'],
}

function generateResponse(req, res) {
	const requestText = req.body && req.body.text
	if (!requestText) return res.end()

	const responses = []
	const rx = /\b([A-Z]+)-\d+\b/ig
	let match
	while ((match = rx.exec(requestText))) {
		const id = match[0]
		if (isRecentlyExpanded(id)) continue

		const type = match[1].toLowerCase()
		const assettype = assettypeMap[type]
		if (!assettype) continue

		responses.push(formatResponse(id, assettype))
		rememberExpanded(id)
	}

	if (!responses.length) return res.end()
	const responseText = responses.join('\n')
	return res.send(JSON.stringify({ text: responseText }))
}

function formatResponse(id, assettype) {
	 return `*<https://www7.v1host.com/V1Production/assetdetail.v1?Number=${id}|${id}>* <https://www7.v1host.com/V1Production/rest-1.v1/Data/${assettype[0]}?deleted=true&amp;accept=application/json&amp;sel=Name,AssetState,Number&amp;where=Number=%27${id}%27|(rest-1)>`
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
