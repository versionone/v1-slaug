"use strict";

const v1request = require('./v1request')

const keysTokens = [
	['AT', 'Test'],
	['B', 'Story'],
	['D', 'Defect'],
	['E', 'Epic'],
	//['EI', 'ExternalActionInvocation'],
	['ENV', 'Environment'],
	['FG', 'Theme'],
	['G', 'Goal'],
	//['GR', 'Grant'],
	['I', 'Issue'],
	['PK', 'Bundle'],
	['R', 'Request'],
	//['R', 'Story'],
	['RD', 'Roadmap'],
	['RP', 'RegressionPlan'],
	['RS', 'RegressionSuite'],
	['RT', 'RegressionTest'],
	['S', 'Story'],
	['ST', 'StrategicTheme'],
	['T', 'Topic'],
	['TH', 'Theme'],
	['TK', 'Task'],
	['TS', 'TestSet'],
]

const map = new Map(keysTokens)

const localizations = new Map()

function fetchLocalizations() {
	const tokens = keysTokens.map(keyToken => keyToken[1])
	const qs =JSON.stringify(tokens)
	v1request({ url: 'loc-2.v1?' + qs })
		.then(names => {
			for (let token of Object.keys(names))
				localizations.set(token, names[token])
		})
		.catch(err => log('ERROR loc-2.v1', JSON.stringify(err.message)))
}

fetchLocalizations()

module.exports = {
	get: key => map.get(key.toUpperCase()),
	localize: token => localizations.get(token) || token
}
