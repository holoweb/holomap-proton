/*

Holomap - Real-time collaborative holonic mapping platform
Copyright (C) 2020 Chris Larcombe

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

// Start node HTTP and HTTPS servers

var app = express();

var privateKey  = fs.readFileSync('sslcert/server.key', 'utf8'); // key
var certificate = fs.readFileSync('sslcert/server.crt', 'utf8'); // crt
var credentials = {key: privateKey, cert: certificate};

server = require('https').createServer(credentials, app);

var httpServer = require('http').createServer(app);

app.enable('trust proxy');

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
	if (process.env.HOLOMAP_DEV)
		res.sendfile(holomapPublicRootPath + 'index.dev.html');
	else
		res.sendfile(holomapPublicRootPath + 'index.html');
});

app.get('/portal', function (req, res)
{
	res.sendfile(holomapPublicRootPath + 'portal.html');
});

app.get('/embed', function (req, res)
{
	if (process.env.HOLOMAP_DEV)
		res.sendfile(holomapPublicRootPath + 'embed.dev.html');
	else
		res.sendfile(holomapPublicRootPath + 'embed.html');
});

// HTTP API
/* app.get('/api/:request/:param', function (req, res)
{
	console.log("params:", req.params.request, req.params.param);
	httpAPI(req.params.request, req.params.param, res);
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
			res.cookie('holonicaddress', req.params['com']+'.'+req.params['hol'], { maxAge: 10000, httpOnly: false});

		if (process.env.HOLOMAP_DEV)
			res.sendfile(holomapPublicRootPath + 'index.dev.html');
		else
			res.sendfile(holomapPublicRootPath + 'index.html');
	}
});

app.get('/(\~?):com', function (req, res)
{
	if (req.params['com'] != 'socket' && req.params['hol'] != 'io')
	{
		if (req.params['com'] != "img")
			res.cookie('holonicaddress', req.params['com'], { maxAge: 10000, httpOnly: false});

		if (process.env.HOLOMAP_DEV)
			res.sendfile(holomapPublicRootPath + 'index.dev.html');
		else
			res.sendfile(holomapPublicRootPath + 'index.html');
	}
});