var store = require('./store');

var WebClient = require('@slack/client').WebClient;

var getSlackWebClient = function(teamId) {

	return store.getTeam(teamId).then(function(team) {

		if (team == null) {
			throw new Error('team_not_found');
		}

		var web = new WebClient(team.access_token);
		return web;

	});

}

module.exports = {
	getSlackWebClient: getSlackWebClient
}