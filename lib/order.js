var sal = require('./sal');
var store = require('./store');

var getOrder = function(groupOrderId) {

	return store.getOrder(groupOrderId).then(function(groupOrder) {

		if (groupOrder){
			return groupOrder;
		}

		return sal.getOwner(groupOrderId).then(function(owner) {
			return sal.getDrinks(groupOrderId).then(function(drinks) {
				return sal.getAvailability().then(function(availability) {

					var order = {
						owner: owner,
						drinks: drinks,
						availability: availability
					};

					return store.setOrder(groupOrderId, order).then(function() {
						return order;
					})

				});
			});
		});

	});

}

module.exports = {
	getOrder: getOrder
}