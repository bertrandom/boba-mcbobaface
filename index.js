var config = require('config');
var express = require('express');
var bodyParser = require('body-parser');
var OAuth = require('oauth');
var exphbs  = require('express-handlebars');
var rp = require('request-promise-native');

var OAuth2 = OAuth.OAuth2;    
var oauth2 = new OAuth2(config.slack.client_id,
	config.slack.client_secret,
	'https://slack.com/', 
	'/oauth/authorize',
	'/api/oauth.access', 
	null);

var WebClient = require('@slack/client').WebClient;

var sal = require('./lib/sal');
var store = require('./lib/store');
var message = require('./lib/message');
var order = require('./lib/order');
var client = require('./lib/client');

var groupOrders = {};

var app = express();

app.engine('hb', exphbs({
	defaultLayout: 'main',
	extname: 'hb'
}));

app.set('view engine', 'hb');

app.enable('view cache');

app.use(express.static('static'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function (req, res) {
	res.render('home');
});

app.get('/complete', function (req, res) {
	res.render('complete');
});

app.get('/privacy', function (req, res) {
	res.render('privacy');
});

app.get('/support', function (req, res) {
	res.render('support');
});

app.get('/install', function (req, res) {
	return res.redirect('https://slack.com/oauth/authorize?&client_id=2801432197.137854611223&scope=links:read,links:write');
});

app.get('/oauth', function (req, res) {

	oauth2.getOAuthAccessToken(
		req.query.code,
		{'grant_type':'client_credentials'},
		function (e, access_token, refresh_token, results) {

			if (e) {
				throw new Error('install_failed');
			}

			store.setTeam(results.team_id, results);
			res.redirect('/complete');

		}
	);

});

app.post('/event', function (req, res) {

	if (!(req && req.body && req.body.token && req.body.token === config.slack.verification_token)){
		return res.sendStatus(401);
	}

	if (req && req.body && req.body.type && req.body.type === 'url_verification'){

		return res.json({
			challenge: req.body.challenge
		});

	}

	res.sendStatus(200);

	var event = req.body.event;

	if (req.body && req.body.event && req.body.event.links && req.body.event.links.length > 0) {

		var link = req.body.event.links[0];
		var url = link.url;

		var matches = url.match(/https:\/\/sweetalittle.com\/group_order\/([0-9a-zA-Z]+)/);

		var groupOrderId;

		if (!matches) {
			return;
		}

		groupOrderId = matches[1];

		return order.getOrder(groupOrderId).then(function(groupOrder) {

			var owner = groupOrder.owner;

			return client.getSlackWebClient(req.body.team_id).then(function(web) {

				var unfurls = {};

				unfurls[url] = {
					"title": owner.user.fname + ' ' + owner.user.lname + "'s Group Order",
					"text": "",
					"callback_id": groupOrderId,
					"actions": [
						{
							"name": "add_drink",
							"text": "Add Drink",
							"type": "button",
							"value": "add_drink"
						},
						{
							"name": "view_cart",
							"text": "View Cart",
							"type": "button",
							"value": "view_cart"
						},
						{
							"name": "lock_order",
							"text": "Lock Order",
							"type": "button",
							"style": "danger",
							"value": "lock_order"
						},
						// 	"name": "cancel_order",
						// 	"text": "Cancel Order",
						// 	"type": "button",
						// 	"style": "danger",
						// 	"value": "cancel_order"
						// },
					]
				};

				web.chat.unfurl(event.message_ts, event.channel, unfurls);

			});


		}).catch(function (err) {

			console.log(err);

			// Don't do anything if we can't find the group order

		});

	}

});

app.post('/interact', function (req, res) {

	var rawPayload = req.body.payload;
	var payload = JSON.parse(rawPayload);

	if (payload.token !== config.slack.verification_token){
		return res.sendStatus(401);
	}

	var teamId = payload.team.id;
	var slackUserId = payload.user.id;

	var action;
	var callbackData;
	var groupOrderId;
	var groupOrder;

	if (payload.type && payload.type === 'dialog_submission'){

		callbackData = JSON.parse(payload.callback_id);

		groupOrderId = callbackData.group_order_id;
		action = callbackData.action;


	}else{

		groupOrderId = payload.callback_id;
		action = payload.actions[0].name;

	}

	return order.getOrder(groupOrderId).then(function(groupOrder) {
		return client.getSlackWebClient(teamId).then(function(web) {

			switch (action) {

				case "add_drink":

					var options = sal.getDrinksDropdown(groupOrder);

					res.json({
						"response_type": "ephemeral",
						"replace_original": false,
						"attachments": [{
							text: "",
							callback_id: groupOrderId,
							actions: [{
								name: 'select_drink',
								text: "Select a drink...",
								type: 'select',
								options: options
							},{
									"name": "cancel_drink",
									"text": "Cancel",
									"type": "button",
									"style": "danger",
									"value": "cancel_drink"
							}]
						}]
					});
					break;

				case "view_cart":

					sal.getCart(groupOrder.owner.user.group_order_owner_id).then(function(cart) {

						var attachments = [];

						var owner = groupOrder.owner;
						// attachments.push({
						// 	"title": owner.user.fname + ' ' + owner.user.lname + "'s Group Order Cart",
						// })

						cart.forEach(function(item){
							if (item.price){

								var match = item.label.match(/\[([0-9A-Z]+) ([0-9A-Z]+) (.*)\] (.*)/);

								var title;

								var drinkUserId = null
								var slackUserText = null;
								var label = null;

								if (match){

									drinkUserId = match[1];
									drinkTeamId = match[2];
									slackUserText = '<@' + drinkUserId + '>';
									label = match[4];

									if (drinkTeamId != teamId){
										slackUserText = match[3];
									}

								}else{

									match = item.label.match(/\[(.*)\] (.*)/);
									if (match){

										slackUserText = match[1];
										label = match[2];

									}

								}

								var fields = [{
									"title": "Label my cup as",
									"value": label,
									"short": false
								},{
									"title": "Milk",
									"value": item.milk,
									"short": true
								},{
									"title": "Sweetness",
									"value": item.sweetness,
									"short": true
								},{
									"title": "Ice",
									"value": item.ice,
									"short": true
								}];

								if (item.topping_list_count > 0){
									var additionalFields = message.displayToppings(item);
									additionalFields.forEach(function(field) {
										fields.push(field);
									});
								}

								attachments.push({
	//								"text": '*' + item.drink_name + '* (*' + '$' + item.price + '*)',
									"text": item.drink_name + ' (*' + '$' + item.price + '*)',
									"pretext": slackUserText,
									"fields": fields,
									"mrkdwn_in": ['text', 'pretext'],
								});

							}
						});

						if (attachments.length == 0) {
							attachments.push({
								"text": 'The cart is empty.',
							});
						}

						attachments.push({
							"text": "",
							"callback_id": groupOrderId,
							"actions": [
								{
									"name": "finish_view_cart",
									"text": "Done Viewing Cart",
									"type": "button",
									"value": "finish_view_cart"
								},
							]
						});

						res.json({
							"response_type": 'ephemeral',
							"replace_original": false,
							"attachments": attachments,
							"text": owner.user.fname + ' ' + owner.user.lname + "'s Group Order",
						});

					});


					break;

				case "select_drink":

					var selectedDrinkId = payload.actions[0].selected_options[0].value;
					var selectedDrink = groupOrder.drinks[selectedDrinkId];

					var drinkOptions = sal.getDrinkOptions(selectedDrinkId);

					var drink = {
						id: selectedDrinkId,
						milk: drinkOptions.milk[0],
						sweetness: drinkOptions.sweetness[0],
						ice: drinkOptions.ice[0],
						toppings: [],
					};

					store.setDrink(groupOrderId, teamId, slackUserId, drink).then(function() {

						var actions = message.drinkActions(drink);
						res.json(message.displayDrink(selectedDrink, drink, groupOrderId, actions));

					});

					break;

				case "unlock_order":
					var owner = groupOrder.owner;

					res.json({
						"response_type": "in_channel",
						"replace_original": true,
						"title": owner.user.fname + ' ' + owner.user.lname + "'s Group Order",
						"text": "",
						"callback_id": groupOrderId,
						"actions": [
							{
								"name": "add_drink",
								"text": "Add Drink",
								"type": "button",
								"value": "add_drink"
							},
							{
								"name": "view_cart",
								"text": "View Cart",
								"type": "button",
								"value": "view_cart"
							},
							{
								"name": "lock_order",
								"text": "Lock Order",
								"type": "button",
								"style": "danger",
								"value": "lock_order"
							},
						],

					});
					break;

				case "lock_order":

					var owner = groupOrder.owner;

					res.json({
						"response_type": "in_channel",
						"replace_original": true,
						"title": owner.user.fname + ' ' + owner.user.lname + "'s Group Order",
						"text": "This order has been locked. Drinks can no longer be added.",
						"callback_id": groupOrderId,
						"actions": [
							{
								"name": "view_cart",
								"text": "View Cart",
								"type": "button",
								"value": "view_cart"
							},
							{
								"name": "unlock_order",
								"text": "Unlock Order",
								"type": "button",
								"style": "primary",
								"value": "unlock_order"
							},
						],

					});
					break;

				case "finish_view_cart":
				case "cancel_drink":
					res.json({
						"response_type": "ephemeral",
						"delete_original": true
					});
					break;

				case "add_to_cart":

					res.status(200).send();

					sal.getOwner(groupOrderId).then(function(owner) {

						store.getDrink(groupOrderId, teamId, slackUserId).then(function(drink) {

							var selectedDrink = groupOrder.drinks[drink.id];
							var drinkOptions = sal.getDrinkOptions(drink.id);

							var elements = [];

							elements.push({
								name: 'label',
								label: "Label my cup as",
								placeholder: '@' + payload.user.name,
								value: '@' + payload.user.name,
								type: 'text',
							});

							elements.push({
								name: 'comments',
								label: "Comments",
								hint: "Write a thank you to " + owner.user.fname + ' ' + owner.user.lname + ' for organizing this order',
								type: 'textarea',
								optional: true,
							});

							var callback_id = {
								action: 'finish_add_to_cart',
								channel_id: payload.channel.id,
								message_ts: payload.message_ts,
								group_order_id: groupOrderId,
								response_url: payload.response_url,
							};

							web.dialog.open(JSON.stringify({
							    "callback_id": JSON.stringify(callback_id),
							    "title": "Add to Cart (" + message.getPrice(drink) + ")",
							    "submit_label": "Add",
							    "elements": elements
							}), payload.trigger_id);

						});
					});

					break;

				case "cancel_order":
					res.json({
						"response_type": "ephemeral",
						"delete_original": true
					});
					break;

				case "finish_add_to_cart":

					res.status(200).send();

					sal.getOwner(groupOrderId).then(function(owner) {
						store.getDrink(groupOrderId, teamId, slackUserId).then(function(drink) {

							var selectedDrink = groupOrder.drinks[drink.id];

							var label = payload.submission.label;

							sal.addToCart(drink, owner, teamId, payload.user, selectedDrink, label).then(function(order) {

								return rp({
									uri: callbackData.response_url,
									method: "POST",
									json: true,
									body: {
										text: '*' + selectedDrink.name + '* (' + message.getPrice(drink) + ') added to cart.',
									},
								}).then(function (body) {
									return body;
								});

							});


						});
					});

					break;

				case "finish_modify":

					res.status(200).send();

					store.getDrink(groupOrderId, teamId, slackUserId).then(function(drink) {

						var selectedDrink = groupOrder.drinks[drink.id];

						drink.milk = payload.submission.select_milk;
						drink.sweetness = payload.submission.select_sweetness;
						drink.ice = payload.submission.select_ice;

						store.setDrink(groupOrderId, teamId, slackUserId, drink).then(function() {

							var actions = message.drinkActions(drink);

							return rp({
								uri: callbackData.response_url,
								method: "POST",
								json: true,
								body: message.displayDrink(selectedDrink, drink, groupOrderId, actions),
							}).then(function (body) {
								return body;
							});

						});

					});

					break;

				case "modify":

					res.status(200).send();

					store.getDrink(groupOrderId, teamId, slackUserId).then(function(drink) {

						var selectedDrink = groupOrder.drinks[drink.id];
						var drinkOptions = sal.getDrinkOptions(drink.id);

						var options = [];
						drinkOptions.milk.forEach(function(option) {
							options.push({
								label: option,
								value: option
							})
						});

						var elements = [];

						elements.push({
							name: 'select_milk',
							label: "Milk",
							type: 'select',
							options: options,
							value: drink.milk
						});

						options = [];
						drinkOptions.sweetness.forEach(function(option) {
							options.push({
								label: option,
								value: option
							})
						});

						elements.push({
							name: 'select_sweetness',
							label: "Sweetness",
							type: 'select',
							options: options,
							value: drink.sweetness
						});

						options = [];
						drinkOptions.ice.forEach(function(option) {
							options.push({
								label: option,
								value: option
							})
						});

						elements.push({
							name: 'select_ice',
							label: "Ice",
							type: 'select',
							options: options,
							value: drink.ice
						});

						var callback_id = {
							action: 'finish_modify',
							channel_id: payload.channel.id,
							message_ts: payload.message_ts,
							group_order_id: groupOrderId,
							response_url: payload.response_url,
						};

						web.dialog.open(JSON.stringify({
						    "callback_id": JSON.stringify(callback_id),
						    "title": "Modify Drink",
						    "submit_label": "Modify",
						    "elements": elements
						}), payload.trigger_id);

					});
					break;

				case "change_milk":

					store.getDrink(groupOrderId, teamId, slackUserId).then(function(drink) {

						var selectedDrink = groupOrder.drinks[drink.id];
						var drinkOptions = sal.getDrinkOptions(drink.id);

						var options = [];
						drinkOptions.milk.forEach(function(option) {
							options.push({
								text: option,
								value: option
							})
						});

						var actions = [{
							name: 'select_milk',
							text: "Select milk...",
							type: 'select',
							options: options
						}];

						res.json(message.displayDrink(selectedDrink, drink, groupOrderId, actions));

					});
					break;

				case "change_sweetness":

					store.getDrink(groupOrderId, teamId, slackUserId).then(function(drink) {

						var selectedDrink = groupOrder.drinks[drink.id];
						var drinkOptions = sal.getDrinkOptions(drink.id);

						var options = [];
						drinkOptions.sweetness.forEach(function(option) {
							options.push({
								text: option,
								value: option
							})
						});

						var actions = [{
							name: 'select_sweetness',
							text: "Select sweetness...",
							type: 'select',
							options: options
						}];

						res.json(message.displayDrink(selectedDrink, drink, groupOrderId, actions));

					});
					break;

				case "change_ice":

					store.getDrink(groupOrderId, teamId, slackUserId).then(function(drink) {

						var selectedDrink = groupOrder.drinks[drink.id];
						var drinkOptions = sal.getDrinkOptions(drink.id);

						var options = [];
						drinkOptions.ice.forEach(function(option) {
							options.push({
								text: option,
								value: option
							})
						});

						var actions = [{
							name: 'select_ice',
							text: "Select ice...",
							type: 'select',
							options: options
						}];

						res.json(message.displayDrink(selectedDrink, drink, groupOrderId, actions));

					});
					break;

				case "change_toppings":

					store.getDrink(groupOrderId, teamId, slackUserId).then(function(drink) {

						var selectedDrink = groupOrder.drinks[drink.id];
						var drinkOptions = sal.getDrinkOptions(drink.id);

						var options = [];

						for (var i = 0; i < groupOrder.availability.topping.length; i++) {

							var topping = groupOrder.availability.topping[i];

							if (topping.quantity > 0) {

								options.push({
									text: topping.name,
									value: topping.name
								});

							}

						}

						var actions = [{
							name: 'add_topping',
							text: "Select a topping...",
							type: 'select',
							options: options
						},{
							"name": "add_topping",
							"text": 'Clear',
							"type": "button",
							"style": "danger",
							"value": "clear",
						}];

						attachments = [{
							"text": "Add Toppings ($0.60 each, up to 2)",
							"image_url": "https://s3-us-west-2.amazonaws.com/sweetalittle/p-landing/ourtoppings/six_toppings_laptop.jpg",
							"callback_id": groupOrderId,
							"actions": actions
						}];

						res.json(message.displayDrink(selectedDrink, drink, groupOrderId, [], attachments));

					});
					break;


				case "select_milk":
				case "select_sweetness":
				case "select_ice":
				case "add_topping":

					store.getDrink(groupOrderId, teamId, slackUserId).then(function(drink) {

						var selectedDrink = groupOrder.drinks[drink.id];

						switch (action) {

							case "select_milk":
								drink.milk = payload.actions[0].selected_options[0].value;
								break;

							case "select_sweetness":
								drink.sweetness = payload.actions[0].selected_options[0].value;
								break;

							case "select_ice":
								drink.ice = payload.actions[0].selected_options[0].value;
								break;

							case "add_topping":
								if (payload.actions[0].value == 'clear') {

									drink.toppings = [];

								} else {

									drink.toppings.push(payload.actions[0].selected_options[0].value);
									if (drink.toppings.length > 2) {
										drink.toppings.shift();
									}

								}
								break;

						}

						store.setDrink(groupOrderId, teamId, slackUserId, drink).then(function() {

		//					var actions = message.modifyActions();
							var actions = message.drinkActions(drink);


							res.json(message.displayDrink(selectedDrink, drink, groupOrderId, actions));

						});

					});
					break;

				case "back_to_drink":

					store.getDrink(groupOrderId, teamId, slackUserId).then(function(drink) {

						var selectedDrink = groupOrder.drinks[drink.id];
						var actions = message.drinkActions(drink);
						res.json(message.displayDrink(selectedDrink, drink, groupOrderId, actions));

					});
					break;

			}

		});
	});

});

app.listen(config.port, function () {
	console.log('Server started on port ' + config.port + '.');
});