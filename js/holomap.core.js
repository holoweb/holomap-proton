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

var NodeStore, HolomapCore;

NodeStore = require('./holomap.nodestore.js');

var fs = require('fs');

HolomapCore = (function()
{
	var store, membrane;

	function HolomapCore()
	{
		store = new NodeStore('holomap');

		store.get_node({'n._t': 'hmadmin'}, function(h)
		{
			if (!h)
			{
				console.log("Initial run... creating meta-ontology...")

				var adminUsername = "admin";

				create_root_holon_node(adminUsername, "_t", "hmadmin", {t: "Holomap Admin", tid:"hmadmin", ct: ["ont"], rgb: "191,62,216"});
				create_root_holon_node(adminUsername, "_t", "ont", {t: "Ontology", tid:"ont", ct: ["_t"], rgb: "208,4,239"});
				create_root_holon_node(adminUsername, "_t", "_t", {t: "Holon Type", tid:"_t", ct: [], rgb: "239,4,153", ad: "t,d,tid,rgb,ct,ad,ae", ae: "t,d,tid,rgb,ct,ad,ae"});
				create_root_holon_node(adminUsername, "_t", "*", {t: "Holon", tid:"*", ct: [], rgb: "0,0,0"});
				create_root_holon_node(adminUsername, "_t", "profile", {t: "Profile", tid:"profile", ct: [], rgb: "0,168,206"});
				create_root_holon_node(adminUsername, "_t", "prep", {t: "Preparation", tid:"prep", ct: [], rgb: "0,0,100"});
				create_root_holon_node(adminUsername, "_t", "map", {t: "Map", tid:"map", ct: [], rgb: "128,0,128"});

				create_root_holon_node(adminUsername, "hmadmin", "admin", {t: "Holomap Administration", d: "Please take care when editing this holon."});

				create_root_holon_node(adminUsername, "map", "home", {t: "Holomap", d: "Welcome to Holomap. This the 'home holon' for this holomap."});

				console.log("Done. Please use UI to create admin account and access ~hmadmin.admin for administration.")
			}
		});
	}

	HolomapCore.prototype.set_membrane = function(m)
	{
		membrane = m;
	}

	HolomapCore.prototype.create_user = function(request, callback)
	{
		store.get_node({'n._t': '_u', $or: [ {'n.u': request.u}, {'n.e': request.e} ] }, function(n)
		{
			if (!n)
			{
				var content = {
				  _id: get_random_id(),
				  _t: '_u',
				  _tc: new Date().getTime(),
				  u: request.u,
				  e: request.e,
				  p: request.p
				};

				store.create_node(content);

				create_default_holons(request.u);

				// Create thumbnail avatar image
				fs.createReadStream('./pub/img/default_avatar.png').pipe(fs.createWriteStream('./pub/img/user/thumb/' + request.u + '.png'));
								
				callback(0);
			}
			else
			{
				console.log("ERROR: user exists; username or e-mail already in use.");

				if (request.u == n.u) // Username is taken
					callback(1);
				else if (request.e == n.e) // E-mail already used on another account
					callback(2);
			}
		});
	}

	var create_default_holons = function(username)
	{
		create_root_holon_node(username, 'profile', username, {t: username, _pe:[username]});
		create_root_holon_node(username, 'prep', username, {t: 'Preparation Space', _pa:[username], _pe:[username]});
	}

	var send_welcome_email = function(email, username)
	{

	}

	var create_root_holon_node = function(user, type, name, attributes)
	{
		store.get_node({'n._t': type, 'n._u': user, 'n._n': name}, function(n)
		{
			if (!n)
			{
				var content = {
				  _id: get_random_id(),
				  _u: user,
				  _t: type,
				  _n: name,
				  _tc: new Date().getTime(),
				};

				add_attributes(content, attributes);
				store.create_node(content);
			}
		});
	}
	HolomapCore.prototype.create_root_holon_node = create_root_holon_node;

	

	HolomapCore.prototype.get_user = function(username, callback)
	{
		store.get_node({'n._t': '_u', 'n.u': username}, function(n)
		{
			if (n)
			{
				callback(n);
			}
			else
			{
				callback(null);
			}
		});
	}

	HolomapCore.prototype.get_session = function(key, callback)
	{
		store.get_node({'n._t': '_s', 'n._id': key}, function(n)
		{
			if (n)
			{
				callback(n);
			}
			else
			{
				callback(null);
			}
		});
	}

	HolomapCore.prototype.get_permissions = function(id, callback)
	{
		store.get_node_fields({'n._id': id}, {'n._pe':1, 'n._pa':1, 'n._u':1}, function(fields)
		{
			callback(fields);
		});
	}

	HolomapCore.prototype.create_session_node = function(username, key, x)
	{
		var content = {
		  _id: key,
		  _t: '_s',
		  _tc: new Date().getTime(),
		  u: username,
		  x: x
		};

		store.create_node(content);
	}

	HolomapCore.prototype.create_holon_node = function(user, type, attributes)
	{
		var content = {
		  _id: get_random_id(),
		  _u: user,
		  _t: type,
		  _tc: new Date().getTime(),
		};

		add_attributes(content, attributes);
		store.create_node(content);
		return content._id;
	}

	HolomapCore.prototype.create_link_node = function(user, fromId, toId, attributes)
	{
		var content = {
		  _id: get_random_id(),
		  _u: user,
		  _t: "_l",
		  _tc: new Date().getTime(),
		  _fi: fromId, // child
		  _ti: toId // parent
		};

		add_attributes(content, attributes);
		store.create_node(content);
		return content._id;
	}

	HolomapCore.prototype.create_link = function(user, fromId, toId, linkAttributes)
	{
		var linkContent = {
		  _id: get_random_id(),
		  _u: user,
		  _t: "_l",
		  _tc: new Date().getTime(),
		  _fi: fromId, // child
		  _ti: toId // parent
		};

		add_attributes(linkContent, linkAttributes);
		store.create_node(linkContent);

		// Return packet (to broadcast)
		return {l: [linkContent]};
	}

	HolomapCore.prototype.create_link_broadcast_child = function(user, fromId, toId, linkAttributes, socket)
	{
		var linkContent = {
		  _id: get_random_id(),
		  _u: user,
		  _t: "_l",
		  _tc: new Date().getTime(),
		  _fi: fromId, // child
		  _ti: toId // parent
		};

		add_attributes(linkContent, linkAttributes);
		store.create_node(linkContent);

		// BROADCAST...

		var hns = [];
		var lns = [linkContent];

		// Get holon
		store.get_node({'n._id': fromId}, function(h)
		{
			if (h)
			{
				hns.push(h);

				// Send to user (holons and links)
				membrane.append_activity_to_holons(hns);
				membrane.broadcast_couple_holarchy_p(socket, toId, {h: hns, l: lns});

				// Uno mas...

				// Get links
				var linksToFind = [];
				for (var i = 0; i < hns.length; i++)
					linksToFind.push( {"n._ti": hns[i]._id} );
				store.get_nodes({'n._t': '_l', $or: linksToFind}, function(lns2)
				{
					if (lns2.length > 0)
					{
						var holonsToFind2 = [];
						for (var i = 0; i < lns2.length; i++)
							holonsToFind2.push( {"n._id": lns2[i]._fi} );

						// Get holons
						store.get_nodes({$or: holonsToFind2}, function(hns2)
						{
							// Send to user (holons and links)
							membrane.append_activity_to_holons(hns2);
							membrane.broadcast_couple_holarchy_p(socket, toId, {h: hns2, l: lns2});
						});
					}
				});
			}
		});
	}

	HolomapCore.prototype.create_linked_holon = function(user, type, toId, holonAttributes, linkAttributes)
	{
		var newHolonId = get_random_id();

		var holonContent = {
		  _id: newHolonId,
		  _u: user,
		  _t: type,
		  _tc: new Date().getTime(),
		  _ci: toId
		};

		add_attributes(holonContent, holonAttributes);
		store.create_node(holonContent);

		var linkContent = {
		  _id: get_random_id(),
		  _u: user,
		  _t: "_l",
		  _tc: new Date().getTime(),
		  _fi: newHolonId, // child
		  _ti: toId // parent
		};

		add_attributes(linkContent, linkAttributes);
		store.create_node(linkContent);

		// Return packet (to broadcast)
		return {h: [holonContent], l: [linkContent]};
	}

	HolomapCore.prototype.create_comment_holon = function(user, type, toId, holonAttributes)
	{
		var newHolonId = get_random_id();

		var holonContent = {
		  _id: newHolonId,
		  _u: user,
		  _t: type,
		  _ti: toId,
		  _tc: new Date().getTime(),
		};

		add_attributes(holonContent, holonAttributes);
		store.create_node(holonContent);

		// Return packet (to broadcast)
		return {h: [holonContent]};
	}

	HolomapCore.prototype.send_comments = function(user, socket, id)
	{
		store.get_nodes({'n._ti': id, 'n._t': {$ne: '_l'} }, function(hns)
		{
			// Send to user 
			membrane.append_activity_to_holons(hns);
			socket.emit('receive_holarchy_packet', {h: hns, _id: id});
			membrane.store_couplings(socket.id, hns);
		});
	}

	HolomapCore.prototype.send_ontology = function(socket, request)
	{
		store.get_nodes({'n._t': "_t", 'n._nl': {$ne: true} }, function(hns)
		{
			// Send to user 
			if (request && request.withTotals)
			{
				var getNextTotal = function(i, holons)
				{
					store.count({'n._t': holons[i].tid}, function(res)
					{
						holons[i].__count = res;
						if (i == holons.length - 1)
							socket.emit('receive_holarchy_packet', {h: holons});
						else
							getNextTotal(i+1, holons)
					});
				}
				getNextTotal(0, hns);
			}
			else
			{
				socket.emit('receive_holarchy_packet', {h: hns});
			}
		});
	}

	HolomapCore.prototype.send_holon = function(user, socket, request)
	{
		var query;
		if (request.address)
		{
			var r = request.address.split('.');
			query = {'n._t': r[0], 'n._n': r[1], $or: [{'n._u': user}, {'n._pa': user}, {'n._pa': []}, {'n._pa': {$exists: false}}]};
		}
		else if (request.id)
		{
			query = {'n._id': request.id, $or: [{'n._u': user}, {'n._pa': user}, {'n._pa': []}, {'n._pa': {$exists: false}}]};
		}

		// Get root holon node
		store.get_node(query, function(n)
		{
			if (n)
			{
				// Send to user
				socket.emit('receive_holarchy_packet', {h: [n]});
				membrane.store_couplings(socket.id, [n]);
			}
		});
	}

	HolomapCore.prototype.send_parent_holons = function(user, socket, holonId)
	{
		// Get links
		store.get_nodes({'n._t': '_l', 'n._fi': holonId, 'n._u': user}, function(lns)
		{
			var holonsToFind = [];
			for (var i = 0; i < lns.length; i++)
				holonsToFind.push( {"n._id": lns[i]._ti} );

			if (holonsToFind.length > 0)
			{
				// Get holons
				store.get_nodes({$or: holonsToFind, 'n._u': user}, function(hns)
				{
					// Send to user (holons and links)
					membrane.append_activity_to_holons(hns);
					socket.emit('receive_holarchy_packet', {h: hns, l: lns, pp: true});
					membrane.store_couplings(socket.id, hns); // hns was: hns.concat(lns)
				});
			}
		});
	}

	HolomapCore.prototype.get_holarchy_no_auth = function(param, callback)
	{
		var query;

		// Assume it's an address
		if (param.indexOf('.') != -1)
		{
			var r = param.split('.');
			query = {'n._t': r[0], 'n._n': r[1], $or: [{'n._pa': []}, {'n._pa': {$exists: false}}]};
		}
		// Assume it's an holon id
		else 
		{
			query = {'n._id': param, $or: [{'n._pa': []}, {'n._pa': {$exists: false}}]};
		}

		// Get root holon node
		store.get_node(query, function(n)
		{
			if (n)
			{
				var response = {holons:[n], links:[], root_holon_id: n._id};

				// Get links
				store.get_nodes({'n._t': '_l', 'n._ti': n._id}, function(lns)
				{
					var holonsToFind = [];
					for (var i = 0; i < lns.length; i++)
						holonsToFind.push( {"n._id": lns[i]._fi} );

					if (holonsToFind.length > 0)
					{
						store.get_nodes({$or: holonsToFind}, function(hns)
						{
							hns = removeInaccessibleHolons(null, hns);

							response.holons = response.holons.concat(hns);
							response.links = response.links.concat(lns);

							// Uno mas...

							// Get links
							var linksToFind = [];
							for (var i = 0; i < hns.length; i++)
								linksToFind.push( {"n._ti": hns[i]._id} );

							store.get_nodes({'n._t': '_l', $or: linksToFind}, function(lns2)
							{
								if (lns2.length > 0)
								{
									var holonsToFind2 = [];
									for (var i = 0; i < lns2.length; i++)
										holonsToFind2.push( {"n._id": lns2[i]._fi} );

									// Get holons
									store.get_nodes({$or: holonsToFind2}, function(hns2)
									{

										hns2 = removeInaccessibleHolons(null, hns2);

										response.holons = response.holons.concat(hns2);
										response.links = response.links.concat(lns2);

										callback(response);
									});
								}
								else
								{
									callback({});
								}
							});
						});
					}
					else
					{
						callback({});
					}
				});
			}
			else
			{
				callback({});
			}
		});
	}

	HolomapCore.prototype.send_holarchy = function(user, socket, request)
	{
		var query;
		if (request.address)
		{
			var r = request.address.split('.');
			query = {'n._t': r[0], 'n._n': r[1], $or: [{'n._u': user}, {'n._pa': user}, {'n._pa': []}, {'n._pa': {$exists: false}}]};
		}
		else if (request.id)
		{
			query = {'n._id': request.id, $or: [{'n._u': user}, {'n._pa': user}, {'n._pa': []}, {'n._pa': {$exists: false}}]};
		}

		// Get root holon node
		store.get_node(query, function(n)
		{
			if (n)
			{
				// Send to user
				if (!request.childHolonsOnly)
				{
					socket.emit('receive_holarchy_packet', {h: [n]});
					membrane.store_couplings(socket.id, [n]);
				}

				// Get links
				store.get_nodes({'n._t': '_l', 'n._ti': n._id}, function(lns)
				{
					var holonsToFind = [];
					for (var i = 0; i < lns.length; i++)
						holonsToFind.push( {"n._id": lns[i]._fi} );

					if (holonsToFind.length > 0)
					{
						// Get holons
						store.get_nodes({$or: holonsToFind}, function(hns)
						{
							hns = removeInaccessibleHolons(user, hns);

							// Send to user (holons and links)
							membrane.append_activity_to_holons(hns);
							socket.emit('receive_holarchy_packet', {h: hns, l: lns});
							membrane.store_couplings(socket.id, hns.concat(lns));

							if (!request.childHolonsOnly)
							{
								// Uno mas...

								// Get links
								var linksToFind = [];
								for (var i = 0; i < hns.length; i++)
									linksToFind.push( {"n._ti": hns[i]._id} );
								store.get_nodes({'n._t': '_l', $or: linksToFind}, function(lns2)
								{
									if (lns2.length > 0)
									{
										var holonsToFind2 = [];
										for (var i = 0; i < lns2.length; i++)
											holonsToFind2.push( {"n._id": lns2[i]._fi} );

										// Get holons
										store.get_nodes({$or: holonsToFind2}, function(hns2)
										{
											hns2 = removeInaccessibleHolons(user, hns2);

											// Send to user (holons and links)
											membrane.append_activity_to_holons(hns2);
											socket.emit('receive_holarchy_packet', {h: hns2, l: lns2});
											membrane.store_couplings(socket.id, hns2.concat(lns2));
										});
									}
								});
							}
						});
					}
				});
			}
		});
	}

	var removeInaccessibleHolons = function(user, hns, extraUser)
	{
		var okay = [];

		for (var i = 0; i < hns.length; i++) {
	
			if (hns[i]._u == user || !hns[i]._pa || hns[i]._pa.length == 0 || hns[i]._pa.indexOf(user) != -1 ||
				(extraUser && (hns[i]._u == extraUser || hns[i]._pa.indexOf(extraUser) != -1)))
			{
				okay.push(hns[i]);
			}
		};

		return okay;
	}

	HolomapCore.prototype.send_grandchildren = function(user, socket, childHolons)
	{
		// Get links
		var linksToFind = [];
		for (var i = 0; i < childHolons.length; i++)
			linksToFind.push( {"n._ti": childHolons[i]} );

		store.get_nodes({'n._t': '_l', $or: linksToFind}, function(lns)
		{
			if (lns.length > 0)
			{
				var holonsToFind = [];
				for (var i = 0; i < lns.length; i++)
					holonsToFind.push( {"n._id": lns[i]._fi} );

				// Get holons
				store.get_nodes({$or: holonsToFind}, function(hns)
				{
					hns = removeInaccessibleHolons(user, hns);

					// Send to user (holons and links)
					membrane.append_activity_to_holons(hns);
					socket.emit('receive_holarchy_packet', {h: hns, l: lns});
					membrane.store_couplings(socket.id, hns.concat(lns));
				});
			}
		});
	}

	HolomapCore.prototype.search = function(user, socket, request)
	{
		var extraUser = null;
		if (typeof request == "object")
		{
			request = request.searchTerm;
			extraUser = "holomapadmin";
		}

		var rx = new RegExp(request, 'i');

		var hs = getStringHolons(request.toLowerCase());

		// Get rid of extra stuff
		var commonStuff = ["the", "in", "a", "on", "it", "and", "for", "to", "i", "be", "is", "where", "when", "how"]; //etc
		for (var i = 0; i < commonStuff.length; i++)
			if (hs.indexOf(commonStuff[i]) != -1)
				hs.remove(hs.indexOf(commonStuff[i]));

		var hashtag = request.toLowerCase().replace(/\W/g, '');
		var rx2;

		try
		{
			rx2 = new RegExp("\\b(" + hs.join("|") + ")\\b", 'i');
		}
		catch(e)
		{
			rx2 = rx;
		}

		store.get_nodes({$or: [{'n.t': rx2}, {'n.d': rx}, {'n.tags': hashtag} ]}, function(holons)
		{
			holons = removeInaccessibleHolons(user, holons, extraUser);

			for (var i = 0; i < holons.length; i++)
			{
				if (holons[i].t)
				{
					var hs2 = getStringHolons(holons[i].t.toLowerCase());

					holons[i]._syn = 0;

					if (holons[i].t.toLowerCase() == request.toLowerCase())
						holons[i]._syn += 50;

					for (var j = 0; j < hs2.length; j++)
					{
						if (hs.indexOf(hs2[j]) != -1)
							holons[i]._syn++;
					};
				}
			};

			socket.emit('receive_search_results', holons);
		});
	}

	var getStringHolons = function(s)
	{
		s = s.replace(/ - /g," ");
		s = s.replace(/  /g," ");
		var ia = s.split(" ");
		var r = [];
		for (var i = 0; i < ia.length; i++)
		{
			r.push(ia[i].toLowerCase())
			for (var j = i+1; j < ia.length; j++)
				r.push(ia.slice(i,j+1).join(' ').toLowerCase());
		}
		return r;
	}

	var getTitleRegex = function(t)
	{
		return new RegExp("\\b(" + getStringHolons(t).join("|") + ")\\b", 'i');
	}

	HolomapCore.prototype.destroy_link = function(user, request, callback)
	{
		// remove link node
		store.destroy_node(request.l._id, function(done)
		{
			if (done)
			{
				callback(done); // true

				if (request.l._fi)
				{
					var hid = request.l._fi;

					// find links request.l._fi
					store.get_nodes({'n._t': '_l', 'n._fi': hid}, function(lns)
					{				
						// if none, find the holon and mark unlinked (unless it is a root holon)
						if (lns.length == 0)
						{
							change_holon(user, {h: {_id: hid, _nl: true} }, function()
							{
							});
						}
					});
				}
			}
		});
	}

	HolomapCore.prototype.change_link = function(user, request, callback)
	{
		// Generate update object for database update query
		var updateObject = new Object();
		for (attrib in request.l)
			if (attrib != '_id')
				updateObject['n.'+attrib] = request.l[attrib];
		
		// Update link node in database		
		store.update_node(request.l._id, updateObject, callback);
	}


	var change_holon = function(user, request, callback)
	{
		// Generate thumbnail if a background was set
		if (request.h._b)
		{
			var im = require('imagemagick');

			var fname = holomapPublicRootPath+'img/user/' + request.h._b;

			im.convert([fname, '-resize', '60x60', holomapPublicRootPath+'img/user/thumb/' + request.h._id + '.png'], 
			function(err, stdout){
			  if (err) throw err;
			  if (user && request.avatar)
			  {
				var fname2 = holomapPublicRootPath+'img/user/thumb/' + user + '.png';
			  	var fs = require('fs');
			 	fs.createReadStream(holomapPublicRootPath+'img/user/thumb/' + request.h._id + '.png').pipe(fs.createWriteStream(fname2));
			  }

			});
		}

		if (request.h.l)
		{
			var geocoder = require('geocoder');

			geocoder.geocode(request.h.l, function ( err3, data )
			{
				if (!err3 && data && data.results.length > 0)
				{
					// Update location
					address = data.results[0].formatted_address;
					ll = [data.results[0].geometry.location.lng, data.results[0].geometry.location.lat];

					//request.h.l = address;
					request.h.ll = ll;

					// Generate update object for database update query
					var updateObject = new Object();
					for (attrib in request.h)
						if (attrib != '_id')
							updateObject['n.'+attrib] = request.h[attrib];
					
					// Update link node in database		
					store.update_node(request.h._id, updateObject, callback);
				}
			});
		}
		else
		{
			// Generate update object for database update query
			var updateObject = new Object();
			for (attrib in request.h)
				if (attrib != '_id')
					updateObject['n.'+attrib] = request.h[attrib];
			
			// Update link node in database		
			store.update_node(request.h._id, updateObject, callback);

		}


	}
	HolomapCore.prototype.change_holon = change_holon;



	HolomapCore.prototype.set_holonic_address = function(user, request, callback)
	{
		if (request.h && request.h._id && request.h._t && request.h._n)
		{
			store.get_node({'n._t': request.h._t, 'n._n': request.h._n}, function(n)
			{
				// Address not already in use
				if (!n)
				{
					var updateObject = new Object();
					updateObject['n._n'] = request.h._n;
					store.update_node(request.h._id, updateObject, function()
					{
						callback(1);
					});
				}
				// Address already in use
				else
				{
					callback(0);
				}
			});
		}
	}

	var change_holon_permission = function(holon, request)
	{
		if (!request.v || !request.ty)
			return false;

		var changeMade = null;

		switch (request.ty)
		{
			case "e_add":
				if (!holon._pe)
					holon._pe = [];

				if (holon._pe.indexOf(request.v) == -1)
				{
					holon._pe.push(request.v);
					changeMade = {'n._pe': holon._pe};
				}
				break;

			case "e_del":
				if (holon._pe && holon._pe.indexOf(request.v) != -1)
				{
					holon._pe.splice(holon._pe.indexOf(request.v), 1);
					changeMade = {'n._pe': holon._pe};
				}
				break;

			case "a_add":
				if (!holon._pa)
					holon._pa = [];

				if (holon._pa.indexOf(request.v) == -1)
				{
					holon._pa.push(request.v);
					changeMade = {'n._pa': holon._pa};
				}
				break;

			case "a_del":
				if (holon._pa && holon._pa.indexOf(request.v) != -1)
				{
					holon._pa.splice(holon._pa.indexOf(request.v), 1);
					changeMade = {'n._pa': holon._pa};
				}
				break;
		}

		if (changeMade)
		{
			//Save holon
			store.update_node(holon._id, changeMade, function()
			{
			});
			return true;
		}
		else
		{
			return false;
		}
	}
	HolomapCore.prototype.change_holon_permission = change_holon_permission;

	// request._u
	// request.v (value, i.e., a username or community)
	// request.ty (type of change, e.g., 'e_add', 'e_del', 'a_add', 'a_del')
	var change_holarchy_permission = function(done, toCheck, request, rootHolonId, broadcastHolonChanges)
	{
		if (toCheck.length > 0 || rootHolonId)
		{
			var holonsToFind = [];
			for (var i = 0; i < toCheck.length; i++)
				holonsToFind.push( {"n._ci": toCheck[i]} );

			if (rootHolonId)
				holonsToFind.push( {"n._id": rootHolonId} );

			store.get_nodes({$or: holonsToFind}, function (holons)
			{
				if (holons.length > 0)
				{
					var holonChanges = [];

					var newDone = [].concat(done);
					var newToCheck = [];
					
					for (var i = 0; i < holons.length; i++)
					{
						if (request._u == holons[i]._u && done.indexOf(holons[i]._id) == -1)
						{
							if (change_holon_permission(holons[i], request))
							{
								if (request.ty[0] == "e") // [0] refers to first character of string (ty is not an array)
									holonChanges.push( {_id: holons[i]._id, _pe: holons[i]._pe} );
								else if (request.ty[0] == "a")
									holonChanges.push( {_id: holons[i]._id, _pa: holons[i]._pa} );
							}

							newDone.push( holons[i]._id );
							newToCheck.push( holons[i]._id );
						}
					}

					change_holarchy_permission(newDone, newToCheck, request, null, broadcastHolonChanges);
					
					broadcastHolonChanges(holonChanges);
				}
			});	
		}
	}	
	HolomapCore.prototype.change_holarchy_permission = change_holarchy_permission;


	var set_password = HolomapCore.prototype.set_password = function(request, callback)
	{
		store.get_node({'n._t': '_u', $or: [ {'n.u': request.u}, {'n.e': request.e} ] }, function(n)
		{
			if (n)
			{
				// Update node in database		
				store.update_node(n._id, {'n.p': request.ph}, function()
				{
					callback(n.e);
				});
			}
		});
	}

	Array.prototype.remove = function(from, to) {
	  var rest = this.slice((to || from) + 1 || this.length);
	  this.length = from < 0 ? this.length + from : from;
	  return this.push.apply(this, rest);
	};

	//

	var get_random_id = function(key_length)
	{
	    var alphabet, chars, i;
	    if (key_length == null) {
	      key_length = 44;
	    }
	    alphabet = "123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ".split(/(?:)/);
	    chars = (function() {
	      var _i, _results;
	      _results = [];
	      for (i = _i = 0; 0 <= key_length ? _i < key_length : _i > key_length; i = 0 <= key_length ? ++_i : --_i) {
	        _results.push(alphabet[Math.floor(Math.random() * 58)]);
	      }
	      return _results;
	    })();
	    return chars.join('');
	};
	HolomapCore.prototype.get_random_id = get_random_id;

	var add_attributes = function(o, attr)
	{
      for (var a in attr)
      	o[a] = attr[a];
	}

	return HolomapCore;
})();

module.exports = HolomapCore;