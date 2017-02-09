"use strict";

const log = require('./log')
const Promise = require('bluebird')
const express = require('express')
const bodyParser = require('body-parser')
const v1request = require('./v1request')

const truthy = value => !!value

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
	at: 'Test',
	b: 'Story',
	d: 'Defect',
	e: 'Epic',
	//ei: 'ExternalActionInvocation',
	env: 'Environment',
	fg: 'Theme',
	g: 'Goal',
	//gr: 'Grant',
	i: 'Issue',
	pk: 'Bundle',
	r: 'Request',
	//r: 'Story',
	rd: 'Roadmap',
	rp: 'RegressionPlan',
	rs: 'RegressionSuite',
	rt: 'RegressionTest',
	s: 'Story',
	st: 'StrategicTheme',
	t: 'Topic',
	th: 'Theme',
	tk: 'Task',
	ts: 'TestSet',
}

function respond(req, res) {
	const requestText = req.body && req.body.text
	if (!requestText) return res.end()

	const matches = findMatches(requestText, /\b([A-Z]+)-\d+\b/ig, match => ({
		number: match[0].toUpperCase(),
		assettype: assettypeMap[ match[1].toLowerCase() ],
		order: match.index,
	}))
	if (!matches.length) return res.end()

	const promisedMessages = matches
		.map(expandAssetReference)

	Promise.all(promisedMessages)
		.then(messages => {
			const responseText = messages.filter(truthy).join('\n')
			res.send({ text: responseText })
		})
		.catch(errorResponse(res))
}

const errorResponse = (function() {
	if (process.env.NODE_ENV === 'production') {
		return res => err => {
			log('ERROR', err.message)
			res.end()
		}
	}
	else {
		return res => err => {
			log('ERROR', err.message)
			res.status(500).send(err)
		}
	}
})()

function findMatches(text, rx, map) {
	const matches = []
	let match
	while ((match = rx.exec(text)))
		matches.push(map(match))
	return matches
}

function expandAssetReference(ref) {
	if (isRecentlyExpanded(ref.number)) return null
	if (!ref.assettype) return null

	const url = 'rest-1.v1/Data/' + ref.assettype
	const sel = 'Name,AssetState,Number'
	const where = `Number='${ref.number}'`
	const deleted = true

	return v1request({ url, qs:{ sel, where, deleted } })
		.then(response => {
			if (!response || !response.Assets || !response.Assets.length) return null
			const asset = response.Assets[0]
			const attributes = asset.Attributes
			return {
				type: ref.assettype,
				id: asset.id,
				number: attributes.Number.value,
				name: attributes.Name.value,
				state: attributes.AssetState.value,
			}
		})
		.then(rememberExpansion)
		.then(formatResponse)
}

function rememberExpansion(asset) {
	if (asset) {
		rememberExpanded(asset.id)
		rememberExpanded(asset.number)
	}
	return asset
}

const formatResponse = (function() {
	const encodings = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
	}

	const encoding = char => encodings[char]
	const encode = text => text.replace(/[&<>]/g, encoding)

	return (asset) => {
		if (!asset) return null
		const encodedName = encode(asset.name)
		if (asset.state >= 255)
			return `*${asset.type} ${asset.number}* (deleted) ~<https://www7.v1host.com/V1Production/assetdetail.v1?Number=${asset.number}|${encodedName}>~`
		if (asset.state >= 192)
			return `*${asset.type} Template ${asset.number}* <https://www7.v1host.com/V1Production/assetdetail.v1?Number=${asset.number}|${encodedName}>`
		if (asset.state >= 128)
			return `*${asset.type} ${asset.number}* (closed) ~<https://www7.v1host.com/V1Production/assetdetail.v1?Number=${asset.number}|${encodedName}>~`
		return `*${asset.type} ${asset.number}* <https://www7.v1host.com/V1Production/assetdetail.v1?Number=${asset.number}|${encodedName}>`
	}
})()

const app = express();
app.set('etag', false)
app.set('query parser', 'simple')
app.set('x-powered-by', false)
app.use(
	processingTimer,
	parseBody,
	logRequest
)

const endpoint = '/' + (process.env.SLAUG_SECRET || '')
app.post(endpoint, respond)

function start(app, port) {
	app.set('port', port);
	app.listen(port, log.defer('listening', port))
}

start(app, process.env.PORT || 61525)
