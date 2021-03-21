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

var HolomapMembrane;

var TwinBcrypt = require('twin-bcrypt');
var sha3_512 = require('js-sha3').keccak_512;
var sha512 = require('js-sha512');
var fs = require('fs');
var crypto = require('crypto'); 
var Datastore = require('nedb');
var nodemailer = require("nodemailer");
var cookie = require('cookie');

httpAPI = null;

require('./holomap.httpserver.js'); // Defines 'server'

HolomapMembrane = (function()
{
	var core;
	var io;

	var couplings, socketCouplings; // track couplings indexed by node id and socket id 
	var targetTotals; // total sockets targetting each holon
	var currentTargets; // socket-id-node id association tracking target holon for each socket
	var socketAuth; // socket.id-username association for authenticated sockets
	var userSockets; // username-socket.id association
	var subscriptions; // storing subscriptions
	var authorisedEmails; // based on subscriptions

	var smtpTransport;
	var apiConfig;
	var socketLog;

	function HolomapMembrane(c)
	{
		core = c;
		couplings = {};
		socketCouplings = {};
		socketAuth = {};
		userSockets = {};
		targetTotals = {};
		currentTargets = {};
		authorisedEmails = {};

		var smtpConfig = require("../cfg/smtpConfig.json");
		smtpTransport = nodemailer.createTransport(smtpConfig);

        var privateKey  = fs.readFileSync('sslcert/server.key', 'utf8'); // key (could also be .pem)
        var certificate = fs.readFileSync('sslcert/server.crt', 'utf8'); // crt (could also be .pem)
        var credentials = {key: privateKey, cert: certificate};

		io = require('socket.io').listen(server, credentials);

		apiConfig = require("../cfg/apiConfig.json");

		var origins = apiConfig.origins;
		if (process.env.HOLOMAP_DEV)
			origins.push('https://localhost:443', 'https://localhost:80');
		io.origins(origins);
		console.log("authorised domains: ", origins.join(", "))

		if (apiConfig.log && apiConfig.log.socket)
		{
			socketLog = {};
			for (var type in apiConfig.log.socket)
				socketLog[type] = new Datastore({ filename: './log/socket.'+type, autoload: true });
		}

		if (apiConfig.subscriptions)
		{
			subscriptions = new Datastore({ filename: './subscriptions', autoload: true });
			subscriptions.find({}, function (err, docs)
    		{
				if (!err && docs)
					for (var i = 0; i < docs.length; i++)
						authorisedEmails[docs[i].e] = true;
			});
		}

		io.sockets.on('connection', function (socket)
		{
			log('connection', socket);

			// ---------------------------------------------

			socket.on('disconnect', function()
			{
				log('disconnect', socket);
				disconnect(socket);
			});

			socket.on('recouple', function(request)
			{
				log('recouple', socket, request);
				recouple(socket, request);
			});
			
			// ---------------------------------------------

			socket.on('auth', function(request)
			{
				log('auth', socket, request);
				auth(socket, request);
			});

			// ---------------------------------------------

			socket.on('get_ontology', function(request)
			{
				log('get_ontology', socket, request);
				get_ontology(socket, request);
			});

			socket.on('get_holarchy', function(request)
			{
				log('get_holarchy', socket, request);
				get_holarchy(socket, request);
			});

			socket.on('get_holon', function(request)
			{
				log('get_holon', socket, request);
				get_holon(socket, request);
			});

			socket.on('get_parent_holons', function(request)
			{
				log('get_parent_holons', socket, request);
				get_parent_holons(socket, request);
			});

			socket.on('get_grandchildren', function(request)
			{
				log('get_grandchildren', socket, request);
				get_grandchildren(socket, request);
			});

			socket.on('search', function(request)
			{
				log('search', socket, request);
				search(socket, request);
			});

			// ---------------------------------------------

			socket.on('create_linked_holon', function(request)
			{
				log('create_linked_holon', socket, request);
				create_linked_holon(socket, request);
			});

			socket.on('create_link', function(request)
			{
				log('create_link', socket, request);
				create_link(socket, request);
			});

			socket.on('destroy_link', function(request)
			{
				log('destroy_link', socket, request);
				destroy_link(socket, request);
			});

			socket.on('change_link', function(request)
			{
				log('change_link', socket, request);
				change_link(socket, request);
			});

			socket.on('change_holon', function(request)
			{
				log('change_holon', socket, request);
				change_holon(socket, request);
			});

			socket.on('change_holarchy_permission', function(request)
			{
				log('change_holarchy_permission', socket, request);
				change_holarchy_permission(socket, request);
			});

			socket.on('set_holonic_address', function(request)
			{
				log('set_holonic_address', socket, request);
				set_holonic_address(socket, request);
			});

			// ---------------------------------------------

			socket.on('target_holon', function(request)
			{
				log('target_holon', socket, request);
				target_holon(socket, request);
			});

			// ---------------------------------------------

			socket.on('create_user', function(request)
			{
				log('create_user', socket, request);
				create_user(socket, request);
			});

			socket.on('reset_password', function(request)
			{
				log('reset_password', socket, request);
				reset_password(socket, request);
			});

			// ---------------------------------------------

			socket.on('create_comment', function(request)
			{
				log('create_comment', socket, request);
				create_comment(socket, request);
			});

			socket.on('get_comments', function(request)
			{
				log('get_comments', socket, request);
				get_comments(socket, request);
			});
		});
	}

	var log = function(type, socket, request)
	{
		const cookies = cookie.parse(socket.request.headers.cookie || '');
		if (apiConfig.log && apiConfig.log.socket && apiConfig.log.socket[type] && socketLog[type])
		{
			var u;
			if (socketAuth[socket.id])
				u = crypto.createHash('sha512').update(socketAuth[socket.id], 'utf8').digest('base64');
			else if (cookies.u)
				u = cookies.u;

			socketLog[type].insert(
				{
					t: new Date().getTime(),
					ip: socket.handshake.address,
					i: cookies.i,
					u: u,
					r: request
				},
			function(err)
			{
				if (err)
					console.log("socket log " + type + " - error saving log:", err);
			});
		}
	}

	httpAPI = function(request, param, req, res)
	{
		switch(request)
		{
			case "subscription":

				if (!apiConfig.subscriptions) return;

				var verifyWebook = function (secret, body, signature)
				{
					signatureComputed = crypto.createHmac('SHA256', secret).update(body).digest('base64');
					return ( signatureComputed === signature ) ? true : false;
				}

				if (verifyWebook(apiConfig.subscriptions.secret, req.rawBody, req.headers['x-wc-webhook-signature']))
				{
					console.log("WEBHOOK VERIFIED")

					if (param == "created" && req.headers['x-wc-webhook-topic'] == "subscription.created")
					{
						if (req.body.billing.email &&
							req.body.line_items && req.body.line_items.length>=1 &&
							req.body.line_items[0].name == apiConfig.subscriptions.name)
						{
							var email = req.body.billing.email;
							console.log("subscription created, authorised", email)

							subscriptions.insert({e: email, t: new Date().getTime()}, function(err)
							{
								if (err)
								{
									console.log("error saving subscription:", err);
								}
							});

							authorisedEmails[email] = true;

							res.send("OK");

							var htmlContents = apiConfig.subscriptions.invite.text.replace("*EMAIL*", email);
							try
							{
								htmlContents = fs.readFileSync(apiConfig.subscriptions.invite.html, { encoding: 'utf8' });
							}
							catch(err)
							{
								console.error(err);
							}

							var mailOptions = {
								from: apiConfig.subscriptions.invite.from,
								to: email,
								subject: apiConfig.subscriptions.invite.subject,
								text: apiConfig.subscriptions.invite.text.replace("*EMAIL*", email),
								html: htmlContents.replace("*EMAIL*", email)
							}

							// Send mail with defined transport object
							smtpTransport.sendMail(mailOptions, function(error, response)
							{
								if (error)
									console.log("Error sending invite e-mail:", error);
							});
						}
					}
				}

				break;
			/*case "getHolarchy":
				core.get_holarchy_no_auth(param, function(response)
				{
					res.json(response);
				})
				break;*/
		}
	}

	var target_holon = function(socket, request)
	{
		// Use browserId rather than socket.id
		var oldId = currentTargets[socket.id];
		var newId = request;

		if (oldId)
			targetTotals[oldId]--;

		currentTargets[socket.id] = newId;

		if (!targetTotals[newId])
			targetTotals[newId] = 0;

		targetTotals[newId]++;

		// Note: the below could be more efficient

		if (couplings[newId])
          for (var i = 0; i < couplings[newId].length; i++)
          	if (io.sockets.connected[couplings[newId][i]])
            	io.sockets.connected[couplings[newId][i]].emit('a', {_id: newId, t: targetTotals[newId]});

        if (oldId && couplings[oldId])
          for (var i = 0; i < couplings[oldId].length; i++)
          	if (io.sockets.connected[couplings[oldId][i]])
            	io.sockets.connected[couplings[oldId][i]].emit('a', {_id: oldId, t: targetTotals[oldId]});
	}

	var decouple = function(socketId, keepCouplings)
	{
		if (socketCouplings[socketId])
		{
			for (var i = socketCouplings[socketId].length - 1; i >= 0; i--)
			{
				var index = couplings[socketCouplings[socketId][i]].indexOf(socketId);
				if (index > -1)
					couplings[socketCouplings[socketId][i]].splice(index, 1);
			};

			delete socketCouplings[socketId];


			if (keepCouplings && io.sockets.connected[socketId])
			{
				recouple(io.sockets.connected[socketId], {ns: keepCouplings});
			}
		}
	}

	var socketClearTargetHolon = function(socketId)
	{
		if (currentTargets[socketId])
		{
			var oldId = currentTargets[socketId];

			if (oldId)
				targetTotals[oldId]--;

			delete currentTargets[socketId];

	        if (oldId && couplings[oldId])
	          for (var i = 0; i < couplings[oldId].length; i++)
	          	if (io.sockets.connected[couplings[oldId][i]])
	            	io.sockets.connected[couplings[oldId][i]].emit('a', {_id: oldId, t: targetTotals[oldId]});
        }
	}

	var disconnect = function(socket)
	{
		if (socketAuth[socket.id])
		{
			var index = userSockets[socketAuth[socket.id]].indexOf(socket.id);
			if (index > -1)
				userSockets[socketAuth[socket.id]].splice(index, 1);

			delete socketAuth[socket.id];
		}

		// Decouple
		decouple(socket.id);
		
		socketClearTargetHolon(socket.id);

        //log_total_sockets();
	}

	var log_total_sockets = function()
	{
		console.log("Sockets with couplings:", Object.keys(socketCouplings).length);
	}

	var store_couplings = function(socketId, nodes)
	{
		if (!socketCouplings[socketId])
		{
			socketCouplings[socketId] = [];
			//log_total_sockets();
		}

		var id;
		for (var i = nodes.length - 1; i >= 0; i--)
		{
			if (typeof nodes[i] == "string")
				id = nodes[i];
			else
				id = nodes[i]._id;

			if (!couplings[id])
				couplings[id] = [];

			if (couplings[id].indexOf(socketId) == -1)
			{
				couplings[id].push(socketId);
				socketCouplings[socketId].push(id);
			}
		};

	}
	HolomapMembrane.prototype.store_couplings = store_couplings;

	HolomapMembrane.prototype.append_activity_to_holons = function(hs)
	{
		for (var i = hs.length - 1; i >= 0; i--)
		{
			if (targetTotals[ hs[i]._id ])
			{
				hs[i]._a = targetTotals[ hs[i]._id ];
			}
		};
	}

	var completeLogin = function(socket, username, p, x)
	{
		// Authenticate socket
		socketAuth[socket.id] = username;
		
		if (userSockets[username])
			userSockets[username].push(socket.id);
		else
			userSockets[username] = [socket.id];

		var key = core.get_random_id();
		create_session( username, key, h2(h2(h2(x + h2(username+p))) + key) );
		socket.emit('auth_resp', {u: username, key: key});
	}

	var auth = function(socket, request)
	{
		// ---- socketAuth; // socket.id-username association for authenticated sockets

		// Authenticate with session key
		if (request.key)
		{
			// Does session exist?
			core.get_session(request.key, function(s)
			{
				// Session (username) found
				if (s)
				{
					TwinBcrypt.compare( h2(s.x + request.key), request.x, function(result)
					{
						// Correct
						if (result)
						{
							// If session exists, authenticate socket
							socketAuth[socket.id] = s.u;

							if (userSockets[s.u])
								userSockets[s.u].push(socket.id);
							else
								userSockets[s.u] = [socket.id];

							socket.emit('auth_resp', {u: s.u});
						}
						else
						{
							socket.emit('auth_resp', {err: 4});
						}
					});
				}
				// Session not found
				else
				{
					socket.emit('auth_resp', {err: 3});
				}
			});
		}
		// Authenticate with username and password
		else if (request.u && request.p)
		{
			// Get user node
			core.get_user(request.u, function(userNode)
			{
				if (userNode)
				{
					TwinBcrypt.compare(userNode.p, request.p, function(result)
					{
						// Correct
						if (result)
						{
							completeLogin(socket, request.u, userNode.p, request.x);
						}
						else
						{
							socket.emit('auth_resp', {err: 2});
						}
					});
				}
				// Username not found
				else
				{
					socket.emit('auth_resp', {err: 1});
				}
			});
		}
		// Incomplete information
		else
		{
			socket.emit('auth_resp', {err: 5});
		}
	}

	var create_session = function(username, key, x)
	{
		core.create_session_node(username, key, x);
	}

	var create_user = function(socket, request)
	{
		if (apiConfig.subscriptions && !authorisedEmails[request.e])
		{
			socket.emit('create_user_resp', {err: 3});
			return;
		}

		core.create_user(request, function(e)
		{
			// User created
			if (!e)
			{
				// Log the user in (authenticate socket)
				completeLogin(socket, request.u, request.p, request.x);

				// Send welcome e-mail
				send_welcome_email(request.e, request.u);

				//notify sign-up successful - begin initiation/tutorial
				socket.emit('create_user_resp', {u: request.u});
			}	
			else
			{
				switch(e)
				{
					// Username taken
					case 1:
						socket.emit('create_user_resp', {err: 1});
						break;
					// E-mail already in use
					case 2:
						socket.emit('create_user_resp', {err: 2});
						break;
				}
			}
		});
	}

	var send_welcome_email = function(email, username)
	{}

	var get_ontology = function(socket, request)
	{
		//console.log(socket.id, "get_ontology", request);
		core.send_ontology(socket, request);
	}

	var get_holarchy = function(socket, request)
	{
		//console.log(socket.id, "get_holarchy", request);

		// Decouple and update (clear) target holon stat

		if (!request.keepAll)
		{
			decouple(socket.id, request.keep);
			socketClearTargetHolon(socket.id);
		}

		core.send_holarchy(socketAuth[socket.id], socket, request);
	}

	var get_holon = function(socket, request)
	{
		//console.log(socket.id, "get_holon", request);
		core.send_holon(socketAuth[socket.id], socket, request);
	}

	var get_parent_holons = function(socket, request)
	{
		core.send_parent_holons(socketAuth[socket.id], socket, request);
	}

	var get_grandchildren = function(socket, request)
	{
		core.send_grandchildren(socketAuth[socket.id], socket, request);
	}

	var search = function(socket, request)
	{
		core.search(socketAuth[socket.id], socket, request);
	}

	var create_linked_holon = function(socket, request)
	{
		// request._t = type of new holon
		// request._ti = parent holon id
		// request.h = attributes of new holon
		// request.l = attributes of new link

		if (socketAuth[socket.id])
		{
			var username = socketAuth[socket.id];

			// TODO: Check username has permission to link a holon in request._ti
			//...

			var packet = core.create_linked_holon(username, request._t, request._ti, request.h, request.l);

			// Broadcast and couple	
			if (couplings[request._ti])
			{
				for (var i = 0; i < couplings[request._ti].length; i++)
				{
					if (io.sockets.connected[couplings[request._ti][i]])
					{
						var s = io.sockets.connected[couplings[request._ti][i]];

						// Broadcast
						s.emit('receive_holarchy_packet', packet);

						// Store couplings
						store_couplings(s.id, packet.h);
						store_couplings(s.id, packet.l);
					}
				}
	        }
		}
	}
	
	var create_link = function(socket, request)
	{
		if (socketAuth[socket.id])
		{
			var username = socketAuth[socket.id];
			core.create_link_broadcast_child(username, request._fi, request._ti, request.l, socket);
		}
	}

	HolomapMembrane.prototype.sendUpdatedWatchNodeWithComment = function(username, wn, cn, whn)
	{
		var packet = {h: [wn, cn]};

		if (whn)
			packet.h.push(whn);

		if (userSockets[username])
		{
			for (var j = 0; j < userSockets[username].length; j++)
			{
				var sid = userSockets[username][j];

				if (io.sockets.connected[sid])
				{
					var s = io.sockets.connected[sid];

					// Broadcast
					s.emit('receive_holarchy_packet', packet);

					// Store couplings
					//store_couplings(s.id, packet.h);
				}
			};
		}

	}


	HolomapMembrane.prototype.broadcast_couple_holarchy_p = function(socket, coupledHolonId, packet)
	{
		// Broadcast and couple	
		if (couplings[coupledHolonId])
		{
			for (var i = 0; i < couplings[coupledHolonId].length; i++)
			{
				if (io.sockets.connected[couplings[coupledHolonId][i]])
				{
					var s = io.sockets.connected[couplings[coupledHolonId][i]];

					// Broadcast
					s.emit('receive_holarchy_packet', packet);

					var nodeArray = [];

					if (packet.h)
						nodeArray = packet.h;

					if (packet.l)
						nodeArray = nodeArray.concat(packet.l);

					// Store couplings
					store_couplings(s.id, nodeArray);
				}
			}
        }
	}

	var destroy_link = function(socket, request)
	{
		core.destroy_link(null, request, function(done)
		{
			if (done)
			{
				// Only broadcast to clients coupled to holon
		        if (couplings[request.l._id])
		          for (var i = 0; i < couplings[request.l._id].length; i++)
		          	if (io.sockets.connected[couplings[request.l._id][i]])
		            	io.sockets.connected[couplings[request.l._id][i]].emit('link_destroyed', request);
	        }
		});
	}

	var change_link = function(socket, request)
	{
		core.change_link(null, request, function()
		{
			// Only broadcast to clients coupled to holon
	        if (couplings[request.l._id])
	          for (var i = 0; i < couplings[request.l._id].length; i++)
	            if (couplings[request.l._id][i] != socket.id)
	              if (io.sockets.connected[couplings[request.l._id][i]])
	                io.sockets.connected[couplings[request.l._id][i]].emit('receive_holarchy_packet', request);
		});
	}

	var can_edit = function(id, username, callback)
	{
		if (id && username)
		{
			core.get_permissions(id, function(permissions)
			{
				if (permissions._u == username ||
					(permissions._pe && (permissions._pe.length == 0 || permissions._pe.indexOf(username) != -1))
				)
					callback(true);
				else
					callback(false);
			});
		}
		else
		{
			callback();
		}
	}



	var can_access = function(id, username, callback)
	{
		if (id && username)
		{
			core.get_permissions(id, function(permissions)
			{
				if (permissions._u == username ||
					(permissions._pa && (permissions._pa.length == 0 || permissions._pa.indexOf(username) != -1))
				)
					callback(true);
				else
					callback(false);
			});
		}
		else
		{
			callback();
		}

	}

	var change_holon = function(socket, request)
	{
		if (!socketAuth[socket.id])
			return;

		can_edit(request.h._id, socketAuth[socket.id], function(hasPermission)
		{
			if (hasPermission)
			{
				core.change_holon(socketAuth[socket.id], request, function()
				{
					// Only broadcast to clients coupled to holon
			        if (couplings[request.h._id])
			          for (var i = 0; i < couplings[request.h._id].length; i++)
			          	if (io.sockets.connected[couplings[request.h._id][i]])
			            	io.sockets.connected[couplings[request.h._id][i]].emit('receive_holarchy_packet', request);
				});
			}
			else
			{
				console.log("****", socketAuth[socket.id]," -- EDIT ACCESS DENIED!")
			}
		});
	}

	var change_holarchy_permission = function(socket, request)
	{
		core.change_holarchy_permission([], [], request, request._id, function(holonChanges)
		{
			var requests = new Object();
					
			for (var i = 0; i < holonChanges.length; i++)
			{
				// Only broadcast to clients coupled to holon
				if (couplings[holonChanges[i]._id])
				{
					// For each socket coupled to holon
					for (var j = 0; j < couplings[holonChanges[i]._id].length; j++)
					{
						var sid = couplings[holonChanges[i]._id][j];
						
						if (!requests[sid])
							requests[sid] = [];

						requests[sid].push(holonChanges[i]);
					}
				}
			}
			
			for (var sid in requests)
			{
				if (io.sockets.connected[sid])
					io.sockets.connected[sid].emit('receive_holarchy_packet', {up:true, h: requests[sid]});
			}

		});
	}

	var set_holonic_address = function(socket, request)
	{
		core.set_holonic_address(null, request, function(done)
		{
			if (done)
			{
				// Only broadcast to clients coupled to holon
		        if (couplings[request.h._id])
		        	for (var i = 0; i < couplings[request.h._id].length; i++)
		        		if (io.sockets.connected[couplings[request.h._id][i]])
		            		io.sockets.connected[couplings[request.h._id][i]].emit('receive_holarchy_packet', request);
			}
			else
			{
				console.log("Error changing holonic address", request);
			}
		});
	}

	var create_comment = function(socket, request)
	{
		if (socketAuth[socket.id])
		{
			var username = socketAuth[socket.id];

			var packet = core.create_comment_holon(username, request._t, request._ti, request.h);

			// If not coupled to holon being commented on for some reason, recouple
			if (!couplings[request._ti] || couplings[request._ti].indexOf(socket.id) == -1)
				store_couplings(socket.id, [request._ti]);

			// Broadcast and couple	
			if (couplings[request._ti])
			{
				for (var i = 0; i < couplings[request._ti].length; i++)
				{
					if (io.sockets.connected[couplings[request._ti][i]])
					{
						var s = io.sockets.connected[couplings[request._ti][i]];

						// Broadcast
						s.emit('receive_holarchy_packet', packet);

						// Store couplings
						store_couplings(s.id, packet.h);
					}
				}
	        }
		}
	}

	var get_comments = function(socket, request)
	{
		var username = socketAuth[socket.id];
		core.send_comments(username, socket, request.h._id);
	}	

	var recouple = function(socket, request)
	{
		store_couplings(socket.id, request.ns);

		// If socket is not authenticated and user has a session (server restarted?)
		if (!socketAuth[socket.id] && request.key)
			socket.emit('reauth', 1);
	}

	var reset_password = function(socket, request)
	{
		if (request.u)
		{
			var p = core.get_random_id(11);

			request.ph = h2(request.u + p); // better of storing bcrypted hash

			core.set_password(request, function(email)
			{
				// E-mail p to user
				console.log("Sending password reset mail to",email)

				var mailOptions = {
				    from: "Holomap <noreply@holomap.org>", // sender address
				    to: email, // list of receivers
				    subject: "Holomap - Password Reset", // Subject line
				    text: "Hi there, your new password is: " + p, // plaintext body
				    html: "Hi there,<br><br>Your new password is: <h2>" + p + "</h2>", // html body
				}

				console.log(mailOptions)
				
				// Send mail with defined transport object
				smtpTransport.sendMail(mailOptions, function(error, response)
				{
				    if (error)
					{
				        console.log("Error sending e-mail:", error);
				    }
					else
					{
				        console.log("E-mail sent - " + JSON.stringify(response));
				    }
				});
			});
		}
	}

	var h2 = function(s)
	{
        return sha3_512(sha512(s));
	}

	return HolomapMembrane;
})();

module.exports = HolomapMembrane;