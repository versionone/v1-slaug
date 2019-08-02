"use strict";

const PORT = Number(process.env.PORT) || 61525
const PRODUCTION = process.env.NODE_ENV === 'production'
const MEMORY = Number(process.env.SLAUG_MEMORY) || 120 * 1000

const log = require('./log')
const logError = err => log('ERROR', JSON.stringify(err.message))
process.on('uncaughtException', err => { logError(err); throw err })
process.on('unhandledRejection', err => { throw err })

const Promise = require('bluebird')
const express = require('express')
const bodyParser = require('body-parser')
const v1request = require('./v1request')
const assetTypes = require('./assetTypes')
const format = require('./format-asset')

const truthy = value => !!value

let last = {}

const _recentlyExpanded = new Set()
const normalizeKey = (key, channel) => key.toUpperCase().replace('%3A', ':') + '/' + (channel || '')
const isRecentlyExpanded = (key, channel) => _recentlyExpanded.has(normalizeKey(key, channel))
const rememberExpanded = (key, channel) => {
	key = normalizeKey(key, channel)
	_recentlyExpanded.add(key)
	setTimeout(() => _recentlyExpanded.delete(key), MEMORY)
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

function ignoreSlackbot(req, res, next) {
	const body = req.body
	if (body && body.user_id === 'USLACKBOT')
		res.end()
	else
		next()
}

function respond(req, res, next) {
	const post = req.body && req.body.text
	if (!post) return res.end()

	let triggers = []
	triggers = triggers.concat(searchTriggers(post))
	if (!triggers.length)
		triggers = triggers.concat(assetNumberTriggers(post)).concat(assetOidTriggers(post))
	if (!triggers.length) return res.end()

	const promisedMessages = triggers
		.map(trigger => trigger.handler.apply(trigger, trigger.args))

	return Promise.all(promisedMessages)
		.then(messages => {
			const responseText = messages.filter(truthy).join('\n')
			const responseBody = { text: responseText };
			if (req.body.thread_ts)
				responseBody.thread_ts = req.body.thread_ts
			res.send(responseBody)
			last = { request: req.body, response: responseBody }
		})
		.catch(err => next(err))
}

function findMatches(text, rx, mapper) {
	const matches = []
	let match
	while ((match = rx.exec(text)))
		matches.push(mapper(match))
	return matches
}

function searchTriggers(post) {
	const rx = /v1\s+find\s+((?:\/\w+\s+)*)(.+)/i
	const match = rx.exec(post)
	if (!match) return []
	return {
		handler: expandSearch,
		args: match,
		index: match.index,
		length: match[0].length,
	}
}

function expandSearch(_, options, find) {
	const url = 'rest-1.v1/Data/BaseAsset'
	const sel = 'AssetType,Name,AssetState,' + assetTypes.numberFields.join(',')
	let where = 'AssetType=' + assetTypes.tokens.map(token => `'${token}'`).join(',')
	const findin = 'Name,Description'
	const deleted = false
	let page = '10,0'
	const sort = '-ChangeDateUTC'

	const rx = /\/(\w+)/g
	let match
	while ((match = rx.exec(options))) {
		const option = match[1].toLowerCase()

		const top = Number(option)
		if (top) {
			page = `${Math.min(top,200)},0`
			continue
		}

		if (option === 'open') {
			where += ";AssetState!='Closed'"
			continue
		}

		if (option === 'closed') {
			where += ";AssetState='Closed'"
			continue
		}
	}

	return v1request({ url, qs:{ sel, where, deleted, findin, find, page, sort } })
		.then(results => {
			if (!results || !results.Assets || !results.Assets.length)
				return "Sorry, nothing found"

			const assets = results.Assets.map(asset => {
				const attributes = asset.Attributes
				return {
					assetType: attributes.AssetType.value,
					oid: asset.id,
					number: attributes.Number.value,
					title: attributes.Name.value,
					state: attributes.AssetState.value,
				}
			})

			const messages = assets.map(format.asset)
			if (results.total > results.pageSize)
				messages.push(format.search(find))

			return  messages.filter(truthy).join('\n')
		})
}

function assetOidTriggers(post) {
	return findMatches(post, /\b([A-Z]+)(?:\:|%3a)(\d+)\b/ig, assetOidTrigger)
}

function assetOidTrigger(match) {
	return {
		handler: expandAssetOid,
		args: match,
		index: match.index,
		length: match[0].length,
	}
}

function expandAssetOid(oid, assetType, assetID, channel) {
	return _expand(oid, assetType, 'ID', `${assetType}:${assetID}`, channel)
}

function assetNumberTriggers(post) {
	return findMatches(post, /\b([A-Z]+)-\d+\b/ig, assetNumberTrigger)
}

function assetNumberTrigger(match) {
	return {
		handler: expandAssetNumber,
		args: match,
		index: match.index,
		length: match[0].length,
	}
}

function expandAssetNumber(number, key, channel) {
	return _expand(number, key, 'Number', number, channel)
}

function _expand(identifier, assetType, field, value, channel) {
	if (isRecentlyExpanded(identifier, channel)) return null

	assetType = assetTypes.get(assetType)
	if (!assetType) return null

	const url = 'rest-1.v1/Data/' + assetType
	const sel = 'AssetType,Name,AssetState,Number'
	const where = `${field}='${value}'`
	const deleted = true

	return v1request({ url, qs:{ sel, where, deleted } })
		.then(results => {
			if (!results || !results.Assets || !results.Assets.length)
				return null
			const asset = results.Assets[0]
			const attributes = asset.Attributes
			return {
				assetType: attributes.AssetType.value,
				oid: asset.id,
				number: attributes.Number.value,
				title: attributes.Name.value,
				state: attributes.AssetState.value,
				channel,
			}
		})
		.then(notRecentlyExpanded)
		.then(rememberExpansion)
		.then(format.asset)
}

function notRecentlyExpanded(asset) {
	return !asset || isRecentlyExpanded(asset.oid, asset.channel) || isRecentlyExpanded(asset.number, asset.channel)? null: asset
}

function rememberExpansion(asset) {
	if (asset) {
		rememberExpanded(asset.oid, asset.channel)
		rememberExpanded(asset.number, asset.channel)
	}
	return asset
}

function prettyJson(value) {
	return safeHtml(JSON.stringify(value, null, 4))
}
function safeHtml(value) {
	return (value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
}

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
app.post(endpoint, ignoreSlackbot, respond)

app.get(endpoint, (req, res) => {
	res.type('html').send(`
		<h3>Last request</h3>
		<pre>${prettyJson(last.request)}</pre>
		<h3>Last response</h3>
		<pre>${prettyJson(last.response)}</pre>
		<h3>Last error</h3>
		<pre>${last.error? safeHtml(last.error.message): 'none'}</pre>
		<pre>${prettyJson(last.error)}</pre>
	`)
})

app.get('/status', (req, res) => {
	res.send("OK. Listening on port " + PORT)
})

app.use((err, req, res, next) => {
	logError(err)
	last = { request: req.body, error: err }
	next(err)
})
if (PRODUCTION)
	app.use((err, req, res, next) => res.end())

function start(app, port) {
	app.set('port', port);
	app.listen(port, log.defer('listening', port))
}

start(app, PORT)
