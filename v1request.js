"use strict";

const request = require('request-promise')

const baseUrl = process.env.V1_URL
if (!baseUrl)
	throw new Error("V1_URL is not defined")

const accessToken = process.env.V1_ACCESSTOKEN
if (!accessToken)
	throw new Error("V1_ACCESSTOKEN is not defined")
const Authorization = 'Bearer ' + accessToken

const v1request = request.defaults({
	jar: true,
	method: 'GET',
	baseUrl,
	headers: {
		'User-Agent': 'v1-slaug',
		Accept: 'application/json',
		Authorization,
	},
})

module.exports = v1request