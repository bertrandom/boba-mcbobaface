#!/usr/bin/env node

var argv = require('yargs')
    .demandCommand(1)
    .argv;

var sal = require('./lib/sal');

var url = argv._[0];

sal.getOwner(url).then(function(owner) {
    sal.getDrinks(url).then(function(drinks) {
        sal.getAvailability().then(function(availability) {
            console.log(owner);
            console.log(drinks);
            console.log(availability);
        });
    });
});