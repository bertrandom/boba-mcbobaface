var getPrice = function(drink, raw = false) {

	var price = 4.95;
	
	if (drink.toppings.length > 0) {
		price += (drink.toppings.length * 0.60);
	}

	if (raw){
		return price;
	}else{
		return "$" + price;
	}


}

var displayToppings = function(drink) {

	var fields = [];

	if (drink.topping_list.length > 0) {

		if (drink.topping_list.length == 2 && drink.topping_list[0] == drink.topping_list[1]) {

			fields.push({
				title: "Toppings",
				value: '2x ' + drink.topping_list[0],
				short: true
			});

		} else {

			fields.push({
				title: "Toppings",
				value: drink.topping_list.join(', '),
				short: true
			});

		}

	}

	return fields;

}

var displayDrink = function(drinkMetadata, drink, groupOrderId, actions, attachments) {

	var fields = [{
		title: "Milk",
		value: drink.milk,
		short: true
	},{
		title: "Sweetness",
		value: drink.sweetness,
		short: true
	},{
		title: "Ice",
		value: drink.ice,
		short: true
	}];

	if (drink.toppings.length > 0) {

		if (drink.toppings.length == 2 && drink.toppings[0] == drink.toppings[1]) {

			fields.push({
				title: "Toppings",
				value: '2x ' + drink.toppings[0],
				short: true
			});

		} else {

			fields.push({
				title: "Toppings",
				value: drink.toppings.join(', '),
				short: true
			});

		}

	}

	var price = getPrice(drink);

	fields.push({
		title: "Price",
		value: price,
		short: true
	});

	var payload = {
		"response_type": "ephemeral",
		"replace_original": true,
		"attachments": [{
			title: drinkMetadata.name,
			image_url: drinkMetadata.imageUrl,
			text: drinkMetadata.description,
			fields: fields,
		}]
	};

	if (attachments) {
		attachments.forEach(function(attachment) {
			payload.attachments.push(attachment);
		});
	} else {
		payload.attachments.push({
			"text": "",
			"callback_id": groupOrderId,
			"actions": actions
		});
	}

	return payload;

}

var drinkActions = function(drink) {

	var price = getPrice(drink);

	return [
		{
			"name": "add_to_cart",
			"text": "Add to Cart (" + price + ")",
			"type": "button",
			"style": "primary",
			"value": "add_to_cart"
		},
		{
			"name": "modify",
			"text": "Modify",
			"type": "button",
			"value": "modify"
		},
		{
			"name": "change_toppings",
			"text": "Toppings",
			"type": "button",
			"value": "change_toppings"
		},
		{
			"name": "cancel_drink",
			"text": "Cancel",
			"type": "button",
			"style": "danger",
			"value": "cancel_drink"
		},
	];

}

var modifyActions = function() {

	return [
		{
			"name": "change_milk",
			"text": "Milk",
			"type": "button",
			"value": "change_milk"
		},
		{
			"name": "change_sweetness",
			"text": "Sweetness",
			"type": "button",
			"value": "change_sweetness"
		},
		{
			"name": "change_ice",
			"text": "Ice",
			"type": "button",
			"value": "change_ice"
		},
		{
			"name": "change_toppings",
			"text": "Toppings",
			"type": "button",
			"value": "change_toppings"
		},
		{
			"name": "back_to_drink",
			"text": "Done Modifying",
			"type": "button",
			"style": "primary",
			"value": "back_to_drink"
		},
	];

}

module.exports = {
	displayDrink: displayDrink,
	displayToppings: displayToppings,
	drinkActions: drinkActions,
	modifyActions: modifyActions,
	getPrice: getPrice,
}