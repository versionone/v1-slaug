"use strict";

const PRODUCTION = process.env.NODE_ENV === 'production'

const log = require('./log')
const logError = err => log('ERROR', JSON.stringify(err.message))
process.on('uncaughtException', err => { logError(err); throw err })
process.on('unhandledRejection', err => { throw err })

const Promise = require('bluebird')
const express = require('express')
const bodyParser = require('body-parser')
const v1request = require('./v1request')
const assetTypes = require('./assetTypes')

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

function respond(req, res) {
	const requestText = req.body && req.body.text
	if (!requestText) return res.end()

	const references = findMatches(requestText, /\b([A-Z]+)-\d+\b/ig, match => ({
		number: match[0].toUpperCase(),
		key: match[1].toUpperCase(),
		index: match.index,
		length: match[0].length,
	}))
	if (!references.length) return res.end()

	const promisedMessages = references
		.map(expandAssetReference)

	Promise.all(promisedMessages)
		.then(messages => {
			const responseText = messages.filter(truthy).join('\n')
			res.send({ text: responseText })
		})
		.catch(errorResponse(res))
}

const errorResponse = (function() {
	if (PRODUCTION) {
		return res => err => {
			logError(err)
			res.end()
		}
	}
	else {
		return res => err => {
			logError(err)
			res.status(500).send(err)
		}
	}
})()

function findMatches(text, rx, mapper) {
	const matches = []
	let match
	while ((match = rx.exec(text)))
		matches.push(mapper(match))
	return matches
}

function expandAssetReference(ref) {
	if (isRecentlyExpanded(ref.number)) return null

	const assetTypeToken = assetTypes.get(ref.key)
	if (!assetTypeToken) return null

	const url = 'rest-1.v1/Data/' + assetTypeToken
	const sel = 'AssetType,Name,AssetState,Number'
	const where = `Number='${ref.number}'`
	const deleted = true

	return v1request({ url, qs:{ sel, where, deleted } })
		.then(results => {
			if (!results || !results.Assets || !results.Assets.length)
				return null
			const asset = results.Assets[0]
			const attributes = asset.Attributes
			return {
				assetType: attributes.AssetType.value,
				id: asset.id,
				number: attributes.Number.value,
				title: attributes.Name.value,
				state: attributes.AssetState.value,
			}
		})
		.then(asset => isRecentlyExpanded(asset.id) || isRecentlyExpanded(asset.number)? null: asset)
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
	const baseUrl = process.env.V1_URL

	// see https://api.slack.com/docs/message-formatting#how_to_escape_characters
	const escapes = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
	}
	const escape = char => escapes[char]
	const slackEscape = text => text.replace(/[&<>]/g, escape)

	return (asset) => {
		if (!asset) return null
		const state = asset.state >= 255? 'deleted': asset.state >= 192? 'template': asset.state >= 128? 'closed': 'open'

		const type = assetTypes.localize(asset.assetType) + (state === 'template'? ' Template': '')
		let number = `*${asset.number}*`
		const href = `${baseUrl}/assetdetail.v1?Number=${asset.number}`
		const title = slackEscape(asset.title)
		let link = `<${href}|${title}>`
		if (state === 'deleted' || state === 'closed') {
			number = `${number} (${state})`
			link = `~${link}~`
		}

		return `${type} ${number} ${link}`
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
