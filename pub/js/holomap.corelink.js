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

(function(){

    var CORELINK = {};
    var root = this;
    var BROWSER;
    var alreadyConnected;
    var ek;
    var socket;

    CORELINK.init = function(_BROWSER, onConnected)
    {
        console.log("CORELINK init");
        alreadyConnected = false;

        BROWSER = _BROWSER;

        var url = window.location.href;
        var urlParts = url.replace('http://','').replace('https://','').split(/[/?#]/);
        var domain = urlParts[0];

        var host = domain; 
        var port = "443";

        // Connect to socket.io on Nodesphere server
        socket = io(host);

        // On connection to server
        socket.on('connect', function()
        {
            if (alreadyConnected)
                BROWSER.recouple();
            else
                onConnected();

            alreadyConnected = true;
        });

        // On disconnect from server
        socket.on('disconnect', function()
        {
            // Notify user of connection issue
            // Suspend editing/interaction?
        });

        // Receive holon targetted count
        socket.on('a', function(a)
        {
            BROWSER.setHolonActivity(a);
        });

        // Called in response to auth
        socket.on('auth_resp', function(res)
        {
            console.log('RX:', 'auth_resp', res);

            // Login successful
            if (res.u)
            {
                console.log("Login successful!");

                BROWSER.loggedIn(res.u);

                if (res.key)
                {
                    localStorage['pepper'] = h2(localStorage['pepper'] + res.key);
                    BROWSER.storeSessionKey(res.key);
                }
    
                ek = h2(localStorage['pepper']);
            }
            else if (res.err)
            {
                switch(res.err)
                {
                    case 1:
                        swal("Username not found!", "Please check your username was typed correctly.", "error");
                        break;
                    case 2:
                        swal("Incorrect password!", "Please re-enter your password carefully.", "error");
                        break;
                    case 5:
                        swal("Authentication failed!", "Error: "+res.err + ". Please contact admin.", "error");
                        break;
                }

                BROWSER.setLoggedOutState();
            }
            else
            {
                BROWSER.setLoggedOutState();
            }
        });

        // Called in response to create_user
        socket.on('create_user_resp', function(res)
        {
            console.log('RX:', 'create_user_resp', res);

            // Sign-up successful
            if (res.u)
            {
                BROWSER.hideJoinBox();
                swal({title: "Welcome to Holomap!", text:"<b>Sign-up completed successfully.</b> You are now logged in!<br><br>Please remember that Holomap is currently in alpha. If you encounter any problems, <i>please just refresh the page</i>; if that doesn't help, contact a member of our team!<br><br>Have fun! :)", type:"success", html: true} );
            }
            else if (res.err)
            {
                switch(res.err)
                {
                    case 1:
                        document.getElementById("jfusername").focus();
                        swal("Username already in use!", "Please choose a different username.", "error");
                        break;
                    case 2:
                        document.getElementById("jfemail").focus();
                        swal("E-mail address already in use!", "E-mail address already in use on another username. Please use a different e-mail address.", "error");
                        break;
                }
            }
            else
            {
                swal("Sign-up Error", "Unknown error.", "error");
            }
        });

        // Called when part of a holarchy is received (a holarchy was requested)
        socket.on('receive_holarchy_packet', function(p)
        {
            console.log("RX:", p);
            BROWSER.processReceivedHolarchyPacket(p);
        });

        socket.on('receive_search_results', function(results)
        {
            console.log("RX:", results);
            BROWSER.receiveSearchResults(results);
        });

        socket.on('link_destroyed', function(p)
        {
            console.log("RX:", p);
            BROWSER.processLinkDestroyed(p);
        });

        // Re-authentication with session key requested
        socket.on('reauth', function()
        {
            BROWSER.authenticateSession();
        });
    }

    var emit = function(a, p)
    {
        console.log("TX:",a,p)
        socket.emit(a, p);
    }
    CORELINK.emit = emit;

    CORELINK.copyLink = function(copiedLink, targetHolonId)
    {
        console.log(copiedLink, targetHolonId);

        // copiedLink is target holon (no location data)
        if (typeof copiedLink == "string")
        {
            copiedLink = {_fi: copiedLink, x: 0, y: 0, s: 0.3};
        }

        emit('create_link', {
            _fi: copiedLink._fi,
            _ti: targetHolonId,
            l: {
                x: copiedLink.x,
                y: copiedLink.y,
                s: copiedLink.s
            }
        } );
    }

    CORELINK.changeLinkSize = function(_id, s)
    {
        emit('change_link', { l: {_id: _id, s: s} } );
    }

    CORELINK.changeLinkPosition = function(_id, x, y)
    {
        emit('change_link', { l: {_id: _id, x: x, y: y} });
    }

    CORELINK.destroyLink = function(_id, _fi)
    {
        emit('destroy_link', { l: {_id: _id, _fi: _fi} });
    }

    CORELINK.createUser = function(u, e, p)
    {
        if (u && e && p)
        {
            var request = {u: u, p: h2(u+p), e: e, x: h2(get_random_key(144))};
            localStorage['pepper'] = h2(h2(request.x + h2(request.u+request.p)));
            emit('create_user', request);
        }
    }

    CORELINK.auth = function(request)
    {
        if (request.p)
        {
            TwinBcrypt.hash(
            h2(request.u+request.p),
            4,
            function(p)
            {},
            function(hash)
            {
                request.x = get_random_key(144);
                localStorage['pepper'] = h2(h2(request.x + h2(request.u+h2(request.u+request.p))));
                request.p = hash;
                emit('auth', request);
            });
        }
        else if (request.key)
        {
            TwinBcrypt.hash(
            h2(localStorage['pepper'] + request.key),
            4,
            function(p)
            {},
            function(hash)
            {
                request.x = hash;
                emit('auth', request);
            });
        }
    }

    CORELINK.createLinkedHolon = function(request)
    {
        if (request._t && request._ti && request.h && request.l)
        {
            BROWSER.waitingForLinkedHolon = [request._t, request._ti];
            emit('create_linked_holon', request);
        }
    }

    var h2 = function(s)
    {
        return CryptoJS.SHA3(CryptoJS.SHA512(s).toString()).toString();
    }

    var get_random_key = function(key_length)
    {
        var alphabet, chars, i;
        if (key_length == null) {
          key_length = 44;
        }
        alphabet = "0123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ!@#$%&/{}()[]=+?*<>\,;.:-_\"".split('');
        chars = (function() {
          var _i, _results;
          _results = [];
          for (i = _i = 0; 0 <= key_length ? _i < key_length : _i > key_length; i = 0 <= key_length ? ++_i : --_i) {
            _results.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
          }
          return _results;
        })();
        return chars.join('');
    };

    ////

	if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = CORELINK;
        }
        exports.CORELINK = CORELINK;
    } else if (typeof define !== 'undefined' && define.amd) {
        define(CORELINK);
    } else {
        root.CORELINK = CORELINK;
    }


}).call(this);