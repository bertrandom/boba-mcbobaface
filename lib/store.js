var bluebird = require('bluebird');
var redis = require("redis");
var cloneDeep = require('clone-deep');

bluebird.promisifyAll(redis.RedisClient.prototype);

var client = redis.createClient();

var setDrink = function(groupOrderId, teamId, slackUserId, drink) {

	var key = 'bobabot:drink:' + groupOrderId + ':' + teamId + ':' + slackUserId;
	var redisDrink = cloneDeep(drink);

	redisDrink.toppings = JSON.stringify(redisDrink.toppings);
	return client.hmsetAsync(key, redisDrink);

}

var getDrink = function(groupOrderId, teamId, slackUserId) {

	var key = 'bobabot:drink:' + groupOrderId + ':' + teamId + ':' + slackUserId;

	return client.hgetallAsync(key).then(function(drink) {
		drink.toppings = JSON.parse(drink.toppings);
		return drink;
	});

}

var setOrder = function(groupOrderId, groupOrder) {
	return client.setAsync('bobabot:order:' + groupOrderId, JSON.stringify(groupOrder), 'EX', 600);
}

var getOrder = function(groupOrderId) {
	return client.getAsync('bobabot:order:' + groupOrderId).then(function(groupOrderRaw) {
		return JSON.parse(groupOrderRaw);
	});
}

var setTeam = function(teamId, team) {
	return client.setAsync('bobabot:team:' + teamId, JSON.stringify(team));
}

var getTeam = function(teamId) {
	return client.getAsync('bobabot:team:' + teamId).then(function(teamRaw) {
		return JSON.parse(teamRaw);
	});
}

module.exports = {
	setDrink: setDrink,
	getDrink: getDrink,
	setOrder: setOrder,
	getOrder: getOrder,
	setTeam: setTeam,
	getTeam: getTeam,
}