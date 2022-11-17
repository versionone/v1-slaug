"use strict";

const assetTypes = require('./assetTypes')

const baseUrl = process.env.V1_URL
if (!baseUrl)
	throw new Error("V1_URL is not defined")

// see https://api.slack.com/docs/message-formatting#how_to_escape_characters
const escapes = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
}
const escape = char => escapes[char]
const slackEscape = text => text.replace(/[&<>]/g, escape)

const logicalState = (numericState) =>
	numericState >= 255? 'deleted':
	numericState >= 192? 'template':
	numericState >= 128? 'closed':
	numericState >= 64? 'open':
	'future'

function formatAsset(asset) {
	if (!asset) return null
	const state = logicalState(asset.state)

	const type = assetTypes.localize(asset.assetType) + (state === 'template'? ' Template': '')
	const number = `*${asset.number}*`;
	const decorator = (state === 'deleted' || state === 'closed')? ` (${state})`: ''
	const href = `${baseUrl}/assetdetail.v1?Number=${asset.number}`
	const title = slackEscape(asset.title)
	const link = `<${href}|${title}>`
	const styledLink = (state === 'deleted' || state === 'closed')? `~${link}~`: link

	return `${type} ${number}${decorator} ${styledLink}`
}

function formatSearch(q) {
	const query = slackEscape(encodeURIComponent(q))
	const href = `${baseUrl}/Search.mvc/Advanced?q=${query}`
	return `<${href}|More...>`
}

module.exports = {
	asset: formatAsset,
	search: formatSearch,
}
