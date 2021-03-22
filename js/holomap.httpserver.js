/*

Holomap - Real-time collaborative holonic mapping platform
Copyright (C) 2021 Chris Larcombe

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.

*/

// Require modules

var express = require('express');
var fs = require('fs');
var multer  = require('multer')
var upload = multer({ dest: './' })
var bodyParser = require('body-parser');
var Datastore = require('nedb');
var cookieParser = require("cookie-parser");

// Start node HTTP and HTTPS servers

var apiConfig = require("../cfg/apiConfig.json");
var log = new Datastore({ filename: './log/pageload', autoload: true });

var app = express();

var privateKey  = fs.readFileSync('sslcert/server.key', 'utf8'); // key
var certificate = fs.readFileSync('sslcert/server.crt', 'utf8'); // crt
var credentials = {key: privateKey, cert: certificate};

server = require('https').createServer(credentials, app);

var httpServer = require('http').createServer(app);

app.enable('trust proxy');

app.use(cookieParser());

app.use (function (req, res, next)
{
	if (req.secure)
	{
		// request was via https, so do no special handling
		next();
	}
	else
	{
		// request was via http, so redirect to https
		res.redirect('https://' + req.headers.host + req.url);
	}
});


if (httpServer.listen(holomapServerPort))
	console.log("...http server up on port " + holomapServerPort + "!");

if (server.listen(443))
	console.log("...https server up on port 443!");

if (process.env.HOLOMAP_DEV)
	console.log("DEVELOPMENT MODE");
else
	console.log("PRODUCTION MODE");

// Routing: root



app.get('/', function (req, res)
{
	if (apiConfig.subscriptions)
		res.cookie('subscriptions', apiConfig.subscriptions.join)
	else
		res.cookie('subscriptions', '')

	var id;
	if (!req.cookies.i)
	{
		id = randomString(50);
		res.cookie('i', id, {maxAge: 1000*60*60*24*9999} );
	}
	else
	{
		id = req.cookies.i;
	}
	
	if (process.env.HOLOMAP_DEV)
		res.sendfile(holomapPublicRootPath + 'index.dev.html');
	else
		res.sendfile(holomapPublicRootPath + 'index.html');

	logPageLoad(req,'index',id)
});

app.get('/terms', function (req, res)
{
	res.sendfile(holomapPublicRootPath + 'terms.html');
	logPageLoad(req,'terms',req.cookies.i)
});

app.get('/privacy', function (req, res)
{
	res.sendfile(holomapPublicRootPath + 'privacy.html');
	logPageLoad(req,'privacy',req.cookies.i)
});

app.get('/portal', function (req, res)
{
	res.sendfile(holomapPublicRootPath + 'portal.html');
	logPageLoad(req,'portal',req.cookies.i)
});

app.get('/embed', function (req, res)
{
	var id;
	if (!req.cookies.i)
	{
		id = randomString(50);
		res.cookie('i', id, {maxAge: 1000*60*60*24*9999} );
	}
	else
	{
		id = req.cookies.i;
	}

	if (process.env.HOLOMAP_DEV)
		res.sendfile(holomapPublicRootPath + 'embed.dev.html');
	else
		res.sendfile(holomapPublicRootPath + 'embed.html');

	logPageLoad(req,'embed',id)
});

// HTTP API

if (apiConfig.subscriptions)
{
	app.use(bodyParser.json({
		verify: (req, res, buf) => {
		  req.rawBody = buf
		}
	  }))

	app.post('/api/subscription/created', (req, res) =>
	{ 
		if (apiConfig.subscriptions.ip == req.connection.remoteAddress)
			httpAPI("subscription","created", req, res);
		else
			console.log("API request from unknown source", req.connection.remoteAddress)
	});
}

/* app.get('/api/:request/:param', function (req, res)
{
	console.log("params:", req.params.request, req.params.param);
	httpAPI(req.params.request, req.params.param, req, res);
}); */

// Routing: image upload

var cpUpload = upload.fields([{ name: 'userPhoto', maxCount: 1 }])

app.post('/img/user', cpUpload, function(req, res)
{
	var serverPath = req.files.userPhoto[0].path;
	var targetFilename = "./pub/img/user/"+req.files.userPhoto[0].filename+".png";

	var fs = require('fs');

	fs.rename(serverPath, targetFilename, function (err) {
	if (err) throw err
	})

	res.send({
		path: serverPath+".png"
	});
});

// Routing: website files

if (process.env.HOLOMAP_DEV)
{
	app.get('/holomap.js', function (req, res) {
		res.sendfile(holomapPublicRootPath + req.url);
	});

	app.get('/js/*.js', function (req, res) {
		res.sendfile(holomapPublicRootPath + req.url);
	});
}
else
{
	app.get('/holomap.build.js', function (req, res) {
		res.sendfile(holomapPublicRootPath + req.url);
	});
}

app.get('/lib/*.js', function (req, res) {
	res.sendfile(holomapPublicRootPath + req.url);
});
app.get('/lib/vendor/*.js', function (req, res) {
	res.sendfile(holomapPublicRootPath + req.url);
});
app.get('/json/*.json', function (req, res) {
	res.sendfile(holomapPublicRootPath + req.url);
});
app.get('/ico/*.ico', function (req, res) {
	res.sendfile(holomapPublicRootPath + req.url);
});
app.get('/mp3/*.mp3', function (req, res) {
	res.sendfile(holomapPublicRootPath + req.url);
});
app.get('/ttf/*.ttf', function (req, res) {
	res.sendfile(holomapPublicRootPath + req.url);
})
app.get('/favicon.ico', function (req, res) {
	res.sendfile(holomapPublicRootPath + '/ico/favicon.ico');
});
app.get('/img/*.(gif|png|jpg|jpeg)', function (req, res) {
	res.sendfile(holomapPublicRootPath + req.url);
});
app.get('/css/*.(css|png)', function (req, res) {
	res.sendfile(holomapPublicRootPath + req.url);
});

// Routing: holonic address

app.get('/(\~?):com\.:hol', function (req, res)
{
	if (req.params['com'] != 'socket' && req.params['hol'] != 'io')
	{
		if (req.params['com']+'.'+req.params['hol'] != "img")
			res.cookie('holonicaddress', req.params['com']+'.'+req.params['hol']);

		var id;
		if (!req.cookies.i)
		{
			id = randomString(50);
			res.cookie('i', id, {maxAge: 1000*60*60*24*9999} );
		}
		else
		{
			id = req.cookies.i;
		}

		logPageLoad(req,'index',id)

		if (process.env.HOLOMAP_DEV)
			res.sendfile(holomapPublicRootPath + 'index.dev.html');
		else
			res.sendfile(holomapPublicRootPath + 'index.html');
	}
});

app.get('/(\~?):map', function (req, res)
{
	if (req.params['map'] != 'socket')
	{
		var id;
		if (!req.cookies.i)
		{
			id = randomString(50);
			res.cookie('i', id, {maxAge: 1000*60*60*24*9999} );
		}
		else
		{
			id = req.cookies.i;
		}

		logPageLoad(req,'index',id,req.params['map'])

		if (process.env.HOLOMAP_DEV)
			res.sendfile(holomapPublicRootPath + 'index.dev.html');
		else
			res.sendfile(holomapPublicRootPath + 'index.html');
	}
});


const randomString = (length = 8) => {
    let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let str = '';
    for (let i = 0; i < length; i++) {
        str += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return str;
};

function logPageLoad(req,page,id,map)
{
	if (apiConfig.log && apiConfig.log.pageload)
	{
		var ip = req.header('x-forwarded-for') || req.connection.remoteAddress;
		log.insert(
			{a: req.header('user-agent'),
			t: new Date().getTime(),
			ip: ip,
			r: req.header('referrer'),
			i: id,
			u: req.cookies.u,
			p: page,
			m: map
			}, function(err)
		{
			if (err)
			{
				console.log("httpserver - error saving log:", err);
			}
		});
	}
}