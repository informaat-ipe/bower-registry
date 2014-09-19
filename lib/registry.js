var express = require('express');
var bodyParser = require('body-parser');
var Package = require('./package').Package;
var http = require('http');

// Create a new registry with a custom database
var Registry = function (options) {
	options = options || {};

	this.private = options.private;
	this.db = options.db || null;
	this.server = express();
	this.server.use(bodyParser.json());
	this.server.use(bodyParser.urlencoded());
};

Registry.prototype = {

	forward: function (path, res) {
		// proxy to http://bower.herokuapp.com/packages/jquery
		//http://bower.herokuapp.com/packages/jquery
		var options = {
			host: 'bower.herokuapp.com',
			port: 80,
			path: path,
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		};

		var p_req = http.request(options, function(p_res)
		{
			var output = '';
			p_res.setEncoding('utf8');

			p_res.on('data', function (chunk) {
				output += chunk;
			});

			p_res.on('end', function() {
				if (p_res.statusCode == 200) {
					res.send(output);
				} else {
					res.send(p_res.statusCode);

				}
			});
		});
		p_req.on('error', function(err) {
			res.send(500);
		});
		p_req.end();

	},

	// Initialize the registry
	initialize: function () {
		// GET /packages
		this.server.get('/packages', function (req, res) {
			this.db.find().then(function (packages) {
				res.send(packages);
			}, function () {
				res.send(500);
			});
		}.bind(this));

		// POST /packages
		this.server.post('/packages', function (req, res) {
			//console.log('POST /packages', this.private);
			var pkg = new Package({
				name: req.param('name'),
				url: req.param('url')
			});

			var errors = pkg.validate({private: this.private});
			if (errors) {
				res.send(errors.join('\n'));
				res.send('\n');
				return res.send(400);
			}

			this.db.add(pkg.toJSON()).then(function () {
				res.send(201);
			}, function () {
				res.send(406);
			});
		}.bind(this));

		// GET /packages/:name
		this.server.get('/packages/:name', function (req, res) {
			//console.log('GET /packages/:name', req.params.name);
			this.db.find({name: req.params.name}).then(function (packages) {
				if (! packages.length) {
					this.forward('/packages/' + req.params.name, res);
				} else {
					this.db.hit(packages[0].name);
					console.log('send',packages[0]);
					res.send(packages[0]);
				}
			}.bind(this), function () {
				res.send(500);
			});
		}.bind(this));

		// GET /packages/search/:name
		this.server.get('/packages/search/:name', function (req, res) {
			//console.log('GET /packages/search/:name');
			this.db.find({
				$match: {
					name: req.params.name
				}
			}).then(function (packages) {
				if (! packages.length) {
					this.forward('/packages/search/' + req.params.name, res);
				} else {
					res.send(packages);
				}
			}.bind(this), function () {
				res.send(500);
			});
		}.bind(this));

		return this;
	},

	// Proxy server.listen
	listen: function () {
		this.server.listen.apply(this.server, arguments);
	}
};

exports.Registry = Registry;
