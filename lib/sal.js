var rp = require('request-promise-native');
var cheerio = require('cheerio');
var cacheManager = require('cache-manager');

var message = require('./message');

var memoryCache = cacheManager.caching({store: 'memory', max: 100, ttl: 60});

var getGroupOrderPage = function(groupOrderId) {

	return memoryCache.wrap(groupOrderId, function() {

		var options = {
		    uri: 'https://sweetalittle.com/group_order/' + groupOrderId,
		    followRedirect: false,
		    transform: function (body) {
		        return cheerio.load(body);
		    }
		};

		return rp(options).then(function ($) {
			return $;
		}).catch(function (err) {

			if (err && err.statusCode == 302){
				throw new Error('group_not_found');
			}

		});

	}).then(function(groupOrderPage) {
		return groupOrderPage;
	});

};

var getOwner = function(groupOrderId) {

	return getGroupOrderPage(groupOrderId).then(function($) {

	    var ownerId = ($('#group_order_owner_id').text());

	    return rp({
	    	uri: 'https://sweetalittle.com/user/load_user',
	    	method: "POST",
	    	json: true,
	    	body: {
	    		user_id: ownerId
	    	},
	    }).then(function (body) {
	    	return body;
	    });

	});

};

var getCart = function(userId) {

    return rp({
    	uri: 'https://sweetalittle.com/user/load_user',
    	method: "POST",
    	json: true,
    	body: {
    		user_id: userId
    	},
    }).then(function (body) {

		if (body && body.user && body.user.cart && body.user.cart.length > 0){
			return body.user.cart;
		}

		return [];

    });

}

var getDrinks = function(groupOrderId) {

	return getGroupOrderPage(groupOrderId).then(function($) {

	    var drinks = {};

	    $('.sal-responsive-desktop .individualProduct').each(function(i, el){

	        el = $(el);

	        var drink = {
	            id: el.attr('data-id'),
	            name: el.attr('data-drink_name'),
	            imageUrl: $('.productImage img', el).attr('src'),
	            description: $('h5', el).text()
	        };

	        drinks[drink.id] = drink;

	    });

	    return drinks;

	});

};

var getAvailability = function() {

    return rp({
		uri: 'https://sweetalittle.com/fulfillment/menu_load_drink_and_topping_availability',
		method: "GET",
		json: true,
    }).then(function (body) {
    	return body;
    });

};

var getDrinksDropdown = function(groupOrder) {

	var drinks = [];

	groupOrder.availability.drink.forEach(function(drink) {

		if (drink.quantity > 0) {
			drinks.push({
				text: drink.name,
				value: drink.sku
			});
		}

	});

	return drinks;

};

var getDrinkOptions = function(drinkId) {

	// Logic hard-coded from https://sweetalittle.com/public/js_build/sal_common.min.js

	var options = {};

	switch (drinkId) {
		case "PassionfruitBlackIcedTea":
		case "ElderflowerGreenIcedTea":
		case "SparklingPeachGreenTea":
		case "StrawberryRoselleTisane":
			options.milk = ['No Milk'];
			break;

		default:
			options.milk = ['Grade-A Milk', 'Almond Milk'];
			break;

	}

	options.sweetness = ['Regular Sweet', 'Semi Sweet', 'Off Dry', 'Dry'];

	switch (drinkId) {
		case "SparklingPeachGreenTea":
			options.ice = ['With Ice'];
			break;

		default:
			options.ice = ['With Ice', 'Without Ice'];
			break;
	}

	return options;

}

var addToCart = function(drink, owner, teamId, user, selectedDrink, label) {

	var encodedName = user.id + ' ' + teamId + ' @' + user.name;

    return rp({
		uri: 'https://sweetalittle.com/user/group_order/join',
		method: "POST",
		json: true,
		body: {
			group_order_friend_name: encodedName,
			group_order_link: owner.user.group_order_link,
			group_order_owner_id: owner.user.group_order_owner_id,
			user_id: null
		},
    }).then(function (body) {

		var payload = {
		    "version": "v2",
		    "drink_name": selectedDrink.name,
		    "milk": drink.milk,
		    "sweetness": drink.sweetness,
		    "ice": drink.ice,
		    "topping_list": drink.toppings,
		    "label": "[" + encodedName + '] ' + label,
		    "price": message.getPrice(drink, true),
		    "user_id": owner.user._id,
		    "topping_list_count": drink.toppings.length,
		    "added_by_id": null
		}

	    return rp({
			uri: 'https://sweetalittle.com/user/cart/add',
			method: "POST",
			json: true,
			body: payload,
	    }).then(function (body) {
	    	return body;
	    });

    });

}

module.exports = {
	getGroupOrderPage: getGroupOrderPage,
	getAvailability: getAvailability,
	getDrinks: getDrinks,
	getDrinksDropdown: getDrinksDropdown,
	getDrinkOptions: getDrinkOptions,
	getOwner: getOwner,
	addToCart: addToCart,
	getCart: getCart,
};