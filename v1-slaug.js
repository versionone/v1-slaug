"use strict";

const log = require('./lib/log')
const Promise = require('bluebird')
const request = require('request-promise')
const express = require('express')
const bodyParser = require('body-parser')

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

function respond(req, res) {
	const requestText = req.body && req.body.text
	if (!requestText) return res.end()

	const matches = findMatches(requestText, /\b([A-Z]+)-\d+\b/ig, match => ({
		number: match[0].toUpperCase(),
		assettype: assettypeMap[ match[1].toLowerCase() ][0],
		order: match.index,
	}))
	if (!matches.length) return res.end()

	const promisedMessages = matches
		.map(expandAssetReference)

	Promise.all(promisedMessages)
		.then(messages => {
			const responseText = messages.filter(truthy).join('\n')
			res
				.type('application/json')
				.send({ text: responseText })
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

const instance = process.env.V1_INSTANCE
if (!instance)
	throw new Error("V1_INSTANCE is not defined")
const urlBase = instance + '/rest-1.v1/Data/'

const accessToken = process.env.V1_ACCESSTOKEN
if (!accessToken)
	throw new Error("V1_ACCESSTOKEN is not defined")
const Authorization = 'Bearer ' + accessToken

const v1request = request.defaults({
	jar: true,
	method: 'GET',
	qs: {
		deleted: 'true',
		sel: 'Name,AssetState,Number',
	},
	headers: {
		'User-Agent': 'v1-slaug',
		Accept: 'application/json',
		Authorization,
	},
})

function expandAssetReference(ref) {
	if (isRecentlyExpanded(ref.number)) return null
	if (!ref.assettype) return null

	const url = urlBase + ref.assettype
	const where = `Number='${ref.number}'`

	return v1request({ url, qs:{ where } })
		.then(JSON.parse)
		.then(response => {
			if (!response || !response.Assets || !response.Assets.length) return null
			const asset = response.Assets[0]
			const attributes = asset.Attributes
			return {
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
	rememberExpanded(asset.id)
	rememberExpanded(asset.number)
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
		return `*${asset.number}* <https://www7.v1host.com/V1Production/assetdetail.v1?Number=${asset.number}|${encodedName}>`
	}
})()

const app = express();
app.set('etag', false)
app.set('query parser', 'simple')
app.set('x-powered-by', false)
app.use(
	processingTimer,
	parseBody,
	logRequest,
	respond
)

function start(app, port) {
	app.set('port', port);
	app.listen(port, log.defer('listening', port))
}

start(app, process.env.PORT || 61525)
