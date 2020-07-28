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

    var BROWSER = {};
    var root = this;
    var hub = {};

    var CORELINK, VIEWER, INFOPANEL;

    var requesting;
    var keepInCache = {};
    var ontology;
    var attributes;
    var thisMap = null;
    
    BROWSER.geom = { headerSize: 48, navbarSize: 92};
    BROWSER.profileHolonId = null;

    ////

    // Functions

    BROWSER.init = function(_VIEWER, _CORELINK, _INFOPANEL)
    {
        console.log("BROWSER init")

        CORELINK = _CORELINK;
        VIEWER = _VIEWER;
        INFOPANEL = _INFOPANEL;

        // Reset browser node cache
        resetCache();

        // Initialise modules
        if (!EMBEDDED)
            _INFOPANEL.init(VIEWER, BROWSER, _CORELINK); 
        _VIEWER.init(BROWSER, _CORELINK, _INFOPANEL); // Set up stage

        _CORELINK.init(BROWSER, function()
        {
            // Authenticate
            authenticateSession();

            // Request ontology
            CORELINK.emit('get_ontology');

            // Load home holon
            var domainInfo = location.hostname.replace("www.","").split('.');
            var hAddress = location.href.replace(origin+'/','').match(/^([a-z0-9]+)\.([a-z0-9]+)$/i);

            if (domainInfo.length == 3)
                thisMap = domainInfo[0];

            if (hAddress)
                getHolarchyByAddress(hAddress[1]+'.'+hAddress[2]);
            else if (domainInfo.length == 3)
                getHolarchyByAddress("map."+thisMap)
            else if (GetUrlValue('address'))
                getHolarchyByAddress(GetUrlValue('address'));
            else
                getHolarchyByAddress("map.home")
        }); 

        $("#searchField").keyup(function(event){
            if(event.keyCode == 13){
                document.getElementById('searchRegion').style.visibility = "hidden";

                var v = document.getElementById('searchField').value.replace('~','');
                if (v && v.indexOf('.') != -1)
                {
                    getHolarchyByAddress(v);
                    document.getElementById('searchField').value = "";
                }
                else
                {
                    INFOPANEL.loadTab("search");
                    document.getElementById('searchQuery').value = $("#searchField").val();
                    INFOPANEL.startSearch();
                }
            }
        });

        $("#clearSearchIcon").click(function(event){
            document.getElementById("searchField").value = "";
            document.getElementById("searchField").focus();
        });

        ontology = {};

        // Defaults (fallback)
        ontology = {
            'profile': {t: 'Profile', rgb: '0,168,206'},
            'prep': {t: 'Preparation', rgb: '0,0,100'},
            'map': {t: 'Map', rgb: '128,0,128'},
            't': {t: 'Thought', cmi: 1, rgb: '128,0,128'}
        };

        // Defaults (primary; hard-coded only for now)
        attributes = {t: {t: "Title", d: "<h3>$.$</h3>", e: "<input id='attr_t' type='text' style='width:100%;' placeholder='Enter title'></input>"},
                    d: {t: "Description", d: "$.$", e: "<h3>Additional information:</h3> <textarea id='attr_d' style='width:98%; height:100px' placeholder='Describe the holon in more detail here (optional)'></textarea>"},
                    asct: {t: "Access-condition type", d: "<div class='accessConditionBox'><b>Access-condition:</b> $.$</div>", e: "<h3>Access-condition:</h3> <select id='attr_asct'><option>Free (unconditional)</option><option>Exchange</option><option>Borrow</option><option>For sale (auction)</option><option>For sale (fixed price)</option></select>"},
                    asc: {t: "Access-condition", d: "<div class='accessConditionDetailsBox'>$.$</div>", e: "Details: <input id='attr_asc' class='textField' type='text' style='width:50%' placeholder='Price, condition, notes, etc.'></input>"},
                    l: {t: "Location", d: "<b>Location:</b> $.$", e: "<h3>Location:</h3><input id='attr_l' type='text' style='width:98%;' placeholder='Enter address or postcode'></input>"},
                    tf: {t: "Time-frame", d: "$.$", e: '<h3>Time-frame:</h3><p id="datepairExample"> <input id="ds" type="text" class="date start" /> <input id="ts" type="text" class="time start" /> to <input id="te" type="text" class="time end" /> <input id="de" type="text" class="date end" /> </p>'},
                    ts: {t: "Start time", d: "Start time: $.ts$", e: "Start time: <input id='attr_ts' class='textField' name='eventStartTime' type='datetime-local'></input>"},
                    te: {t: "End time", d: "End time: $.te$", e: "End time: <input id='attr_te' class='textField' name='eventEndTime' type='datetime-local'></input>"},
                    tid: {t: "Type ID", d: "<b>Type ID:</b> $.$", e:"Type ID: <input id='attr_tid' type='text' style='width:150px'></input>"},
                    cmi: {t: "Comment index", d: "<b>Comment index:</b> $.$", e:"Comment index: <input id='attr_cmi' type='text' style='width:150px'></input>"},                    
                    sid: {t: "Service ID", d: "Service ID: $.sid$", e:"Service ID: <input id='attr_sid' type='text' style='width:50'></input>"},
                    url: {t: "URL", d: "Web-link: <b><u><a href='$.url$' target='_new'>$.url$</a></u></b>", e: "Web-link: <input id='attr_url' type='text' class='textField' style='width:95%' placeholder='The website address (URL)'></input>"},
                    imgurl: {t: "Image URL", d: "<img src='$.imgurl$' width='100%' onload=\"call('setPageLayout')\"></img>", e: "Image web-link (URL): <input id='attr_imgurl' class='textField' type='text' style='width:95%' placeholder='Website address (URL) to image file'></input>"},
                    vidurl: {t: "Video", d: "$.vidurl$", e: "YouTube Video Embed code (iframe tag): <input id='attr_vidurl' class='textField' type='text' style='width:95%' placeholder='Paste embed code here (copied from YouTube)'></input>"},
                    ct:{t: "Child types", d: "<b>Child types:</b> $.$", e: "Child types: <input id='attr_ct' type='text' style='width:95%'></input>"},
                    ad:{t: "Display attributes", d: "<b>Attributes (display)</b>: $.$", e: "Attributes (display): <input id='attr_ad' type='text' style='width:95%'></input>"},
                    ae:{t: "Editable attributes", d: "<b>Attributes (edit)</b>: $.$", e: "Attributes (edit): <input id='attr_ae' type='text' style='width:95%'></input>"},
                    rgb:{t: "RGB Colour", d: "<b>Colour (r,g,b)</b>: $.$", e: "Colour (r,g,b): <input id='attr_rgb' type='text' style='width:150px'></input>"},                    
                    isGlobal:{t: "Is a global service (single holon instance)", d: "<b>$.isGlobal$</b>", e: "Is a global service (single holon instance) <input id='attr_isGlobal' type='checkbox'></input>"},
                    isCocreative:{t: "Is a co-creative holon (users can create holons in here)", d: "<b>$.isCocreative$</b>", e: "Is a co-creative holon (users can create holons in here) <input id='attr_isCocreative' type='checkbox'></input>"},
                    isComplete:{t: "Action is complete", d: "Complete: <b>$.isComplete$</b>", e: "Is complete <input id='attr_isComplete' type='checkbox'></input>"},
                    col:{t: "Collaborators", d: "Collaborators: <b><font color='yellow'>$.col$</font></b>", e: "Collaborators: <input id='attr_col' type='text' class='textField' placeholder='Who has assigned themselves to this action (collaborators)' style='width:95%'></input>"}
                    };

        var needToConfirm = true;
        window.onbeforeunload = confirmExit;
        function confirmExit()
        {
            if (needToConfirm)
            {
                return "You are about to leave Holomap. Are you sure you want to exit this page?";
            }
        }

        if (document.getElementById('forgotPassword'))
        {
            document.getElementById('forgotPassword').onclick = function()
            {
                var u = document.getElementById('username').value;

                if (!u)
                {
                    swal({title: "Password Reset", text: "Please enter your username:", type: "input", showCancelButton: true, closeOnConfirm: false, animation: "slide-from-top",   inputPlaceholder: "Your username" }, function(inputValue){   if (inputValue === false) return false;      if (inputValue === "") {     swal.showInputError("You need to enter your username!");     return false   }
                         CORELINK.emit('reset_password', {u: inputValue}); swal("Done!", "Please check your e-mail now."); });
                }

                if (u)
                {
                    CORELINK.emit('reset_password', {u: u});
                    swal("Password Reset!", "Please check your e-mail now (associated with username " + u + ").");
                }
            }
        }

        if (!EMBEDDED)
        {
            document.getElementById('navHome').onclick = function()
            {
                if (thisMap)
                    getHolarchyByAddress("map."+thisMap);
                else
                    getHolarchyByAddress("map.home");
            }

            document.getElementById('navProfile').onclick = function()
            {
                getHolarchyByAddress("profile."+BROWSER.username);
            }

            document.getElementById('navPrep').onclick = function()
            {
                getHolarchyByAddress("prep."+BROWSER.username);
            }

            document.getElementById('navSearch').onclick = function()
            {
                if (!document.getElementById('searchRegion').style.visibility || document.getElementById('searchRegion').style.visibility != "visible")
                    document.getElementById('searchRegion').style.visibility = "visible";
                else
                    document.getElementById('searchRegion').style.visibility = "hidden";

                document.getElementById("searchField").value = "";
                document.getElementById("searchField").focus();
            }
        }

        navigator.sayswho= (function(){
            var ua= navigator.userAgent, tem,
            M= ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
            if(/trident/i.test(M[1])){
                tem=  /\brv[ :]+(\d+)/g.exec(ua) || [];
                return 'IE '+(tem[1] || '');
            }
            if(M[1]=== 'Chrome'){
                tem= ua.match(/\b(OPR|Edge)\/(\d+)/);
                if(tem!= null) return tem.slice(1).join(' ').replace('OPR', 'Opera');
            }
            M= M[2]? [M[1], M[2]]: [navigator.appName, navigator.appVersion, '-?'];
            if((tem= ua.match(/version\/(\d+)/i))!= null) M.splice(1, 1, tem[1]);
            return M.join(' ');
        })();

        if (navigator.sayswho.toLowerCase().indexOf("chrome") == -1)
            swal({title:"Browser Compatibility", html:true, text:"Your browser has been deteced as '" + navigator.sayswho + "'. Holomap may still function, however this version of Holomap has only been tested in <i>Google Chrome</i>.<h4>For best results please use Google Chrome</h4>", type:"warning"});
    }

    BROWSER.getOntology = function(_t)
    {
        if (_t)
            return ontology[_t];
        else
            return ontology;
    }

    BROWSER.getAttributes = function()
    {
        return attributes;
    }

    BROWSER.getTypeName = function(_t)
    {
        if (ontology[_t])
        {
            return ontology[_t].t;
        }
    }
    
    BROWSER.setHolonActivity = function(a)
    {
        if (BROWSER.cache.h[a._id])
        {
            BROWSER.cache.h[a._id]._a = a.t;
            
            if (BROWSER.cache.h[a._id].__o)
            {
                VIEWER.setHolonActivity(a._id, a.t);
            }   
        }
    }

    BROWSER.showLogin = function()
    {
        showLoginBox();

        $('#loginForm').submit(function()
        {
            var usr = document.getElementById('username').value.toLowerCase();
            var pwd = document.getElementById('password').value;

            if (usr && pwd && usr != "" && pwd != "")
            {
                CORELINK.auth({u: usr, p: pwd});
                document.getElementById('password').value = "";
            }
            else
            {
                swal("Login Error", "Please enter a username and a password.", "error");
            }
        });
                
    }

    var setLoggedOutState = function()
    {
        BROWSER.username = null;

        if (!EMBEDDED)
        {
            document.getElementById('loginLinks').innerHTML = '<div><a id="logoutLink" href="#">Login</a></div>';
            document.getElementById('infoLoginRegion').style.opacity = 1;
            document.getElementById('navProfile').style['background-image'] = 'url(/img/navProfile.png)';

            if (GetUrlValue('j') || GetUrlValue('enableJoin') )
            {
                document.getElementById('loginLinks').innerHTML = '<div><a id="joinLink" href="#">Join</a> &nbsp; &bullet; &nbsp; <a id="logoutLink" href="#">Login</a></div>';

                document.getElementById('joinLink').onclick = function()
                {
                    showJoinBox();
                }
            }

            document.getElementById('logoutLink').onclick = function()
            {
                showLoginBox();
                document.getElementById('username').focus();

                document.getElementById('username').style['border-color'] = '';
                document.getElementById('password').style['border-color'] = '';

                document.getElementById('closeLoginPopup').onclick = function()
                {
                    hideLoginBox();
                }

                $('#loginForm').submit(function()
                {
                    var usr = document.getElementById('username').value.toLowerCase();
                    var pwd = document.getElementById('password').value;

                    if (usr && pwd && usr != "" && pwd != "")
                    {
                        CORELINK.auth({u: usr, p: pwd});
                        document.getElementById('password').value = "";
                    }
                    else
                    {
                        swal("Login Error", "Please enter a username and a password.", "error");
                    }
                });
            }
        }

        VIEWER.loggedOut();
    }
    BROWSER.setLoggedOutState = setLoggedOutState;

    BROWSER.processLoginError = function(err)
    {
        switch(err)
        {
            case 1:
                document.getElementById('username').style['border-color'] = 'red';
                break;
            case 2:
                document.getElementById('password').style['border-color'] = 'red';
                break;
            case 3:
            case 4:
                showLoginBox();
                break;
            case 5:
                alert("Incomplete information for login.");
        }
    }

    var showLoginBox = function()
    {
        document.getElementById('loginPopup').style.visibility = 'visible';
        document.getElementById('screenShade').style.visibility = 'visible';
        $('#main').addClass('blur-filter');
    }

    var hideLoginBox = function()
    {
        if (!EMBEDDED)
            document.getElementById('loginPopup').style.visibility = 'hidden';
        document.getElementById('screenShade').style.visibility = 'hidden';
        $('#main').removeClass('blur-filter');
    }

    var showJoinBox = function()
    {
        document.getElementById('joinPopup').style.visibility = 'visible';
        document.getElementById('screenShade').style.visibility = 'visible';
        $('#main').addClass('blur-filter');

        document.getElementById('closeJoinPopup').onclick = function()
        {
            hideJoinBox();
        }

        $('#joinForm').submit(function()
        {
            processJoinForm();

        });
    }

    var processJoinForm = function()
    {
        var user = document.getElementById("jfusername").value.toLowerCase().trim();
        document.getElementById("jfusername").value = user;
        var pass = document.getElementById("jfpassword").value;
        var pass2 = document.getElementById("jfpassword2").value;
        var email = document.getElementById("jfemail").value.toLowerCase().trim();
        document.getElementById("jfemail").value = email;
        var reg = /^([A-Za-z0-9_\-\.])+\@([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,4})$/;
        
        if (!/^[a-z0-9]+$/.test(user) && user.length >= 2)
        {
            swal("Invalid Username!", "You may use letters and numbers only.", "error");
            document.getElementById("jfusername").focus();
            return false;   
        }
        else if (reg.test(email) == false)
        {
            swal("Invalid E-mail Address!", "Please enter a valid e-mail address. Your e-mail will be kept private, and will not be visible on the network.", "error");
            document.getElementById("jfemail").focus();
            return false;
        }
        else if (!pass)
        {
            swal("No password!", "Please enter a password.", "error");
            document.getElementById("jfpassword").focus();
            return false;
        }
        else if (pass != pass2)
        {
            swal("Password mismatch!", "Passwords do not match! Please re-enter your password twice, the same each time (confirm your password).", "error");
            document.getElementById("jfpassword").focus();
            document.getElementById("jfpassword").value = "";  
            document.getElementById("jfpassword2").value = "";
            return false;
        }
        else
        { 
            // Attempt to sign up user (depending on availability of username)
            swal({   title: "Ready to go...",   text: "<b>Before we sign you up, please check you have typed your desired username and e-mail address correctly.<h2>" + user + "</h2><h2>" +email + "</h2>", html:true,   type: "success",   showCancelButton: true,   confirmButtonColor: "#DD6B55", closeOnConfirm: false, confirmButtonText: "Yes, sign me up!" }, function(isConfirm){   if (isConfirm)
                {
                    CORELINK.createUser(user, email, pass);   
                } });
        }
    }

    var hideJoinBox = BROWSER.hideJoinBox = function()
    {
        document.getElementById("jfpassword").value = "";  
        document.getElementById("jfpassword2").value = "";
        if (!EMBEDDED)
            document.getElementById('joinPopup').style.visibility = 'hidden';
        document.getElementById('screenShade').style.visibility = 'hidden';
        $('#main').removeClass('blur-filter');
    }

    var setLoggedInState = function()
    {
        if (!EMBEDDED)
        {
            document.getElementById('loginLinks').innerHTML = "<div>" + BROWSER.username + '<br><a id="logoutLink" href="javascript:">Logout</a></div>';
            document.getElementById('infoLoginRegion').style.opacity = "";
            document.getElementById('navProfile').style['background-image'] = 'url(/img/user/thumb/' + BROWSER.username + '.png)';

            document.getElementById('logoutLink').onclick = function()
            {
                logout();
            }
        }

        VIEWER.loggedIn();
    }
    BROWSER.setLoggedInState = setLoggedInState;

    BROWSER.loggedIn = function(username)
    {
        BROWSER.username = username;
        setLoggedInState();
        hideLoginBox();
    }

    BROWSER.recouple = function()
    {
        if (Object.keys(BROWSER.cache.h).length > 0 || Object.keys(BROWSER.cache.l).length > 0)
        {
            var nodeIds = [];
            for (var id in BROWSER.cache.h)
                nodeIds.push(id);
            for (var id in BROWSER.cache.l)
                nodeIds.push(id);

            CORELINK.emit('recouple', {key: localStorage['session'], ns: nodeIds});               
        }
    }

    var resetCache = function()
    {
        if (!BROWSER.cache)
            BROWSER.cache = {h:{}};

        if (!EMBEDDED && BROWSER.cache && BROWSER.cache.h)
        {
            // Remove all holons from cache apart from conversations and comment holons being displayed
            var conversationId = INFOPANEL.getCurrentHolonId();

            for (var id in BROWSER.cache.h)
            {
                if (!keepInCache[id] && BROWSER.cache.h[id]._t != "con" && !(BROWSER.cache.h[id]._ti && BROWSER.cache.h[id]._ti == conversationId) )
                {
                    delete BROWSER.cache.h[id];
                }
                else if (BROWSER.cache.h[id]._t == "con" && id != conversationId)
                {
                    BROWSER.cache.h[id].__requestedComments = false;
                    BROWSER.cache.h[id].__c = null;
                }
            }
        }

        BROWSER.cache.l = {};
        BROWSER.cache.c = {};
    }

    var resetBrowserState = function()
    {
        VIEWER.reset();
        resetCache();
    }

    getHolarchyByAddress = function(address)
    {
        resetBrowserState();
        
        // Set requesting state
        requesting = address.split('.');

        // Hide curret target holon and child holons
        VIEWER.hide_target_holon();

        // Show loading animation.
        VIEWER.show_loading_animation();

        // Request the new holarchy
        var keep;
        CORELINK.emit('get_holarchy', {address: address, keep: keep} );
    }
    BROWSER.getHolarchyByAddress = getHolarchyByAddress;

    var getHolonByAddress = BROWSER.getHolonByAddress = function(address)
    {
        CORELINK.emit('get_holon', {address: address} );
    }

    getHolarchyById = function(id, keepCache)
    {
        if (!keepCache)
            resetBrowserState();
        
        // Set requesting state
        requesting = id;

        // Hide curret target holon and child holons
        VIEWER.hide_target_holon();

        // Show loading animation.
        VIEWER.show_loading_animation();

        // Request the new holarchy
        var keep;
        CORELINK.emit('get_holarchy', {id: id, keep: keep});
    }
    BROWSER.getHolarchyById = getHolarchyById;

    BROWSER.haveReceivedChildHolons = function(chid)
    {
        var holon = BROWSER.cache.h[chid];
        if (holon.__l && holon.__l.length > 0)
            for (var i = holon.__l.length - 1; i >= 0; i--)
                if (BROWSER.cache.l[ holon.__l[i] ] && BROWSER.cache.h[ BROWSER.cache.l[ holon.__l[i] ]._fi ] && BROWSER.cache.h[ BROWSER.cache.l[ holon.__l[i] ]._fi ]._id)
                    return true;
        return false;
    }

    BROWSER.receiveSearchResults = function(results)
    {
        INFOPANEL.displaySearchResults(results);
    }

    BROWSER.getGrandchildHolons = function(holon)
    {
        var chid;

        if (holon.__l && holon.__l.length > 0 && !holon.__rg)
        {
            var childHolonIds = [];

            for (var i = holon.__l.length - 1; i >= 0; i--)
            {
                if (!BROWSER.cache.h[ BROWSER.cache.l[ holon.__l[i] ]._fi ])
                    continue;

                chid = BROWSER.cache.h[ BROWSER.cache.l[ holon.__l[i] ]._fi ]._id;

                if (!BROWSER.haveReceivedChildHolons(chid))
                    childHolonIds.push(  chid  );
            };

            if (childHolonIds.length > 0)
            {
                CORELINK.emit('get_grandchildren', childHolonIds);
                holon.__rg = true;
            }
        }
    }

    function GetUrlValue(VarSearch){
        var SearchString = window.location.search.substring(1);
        var VariableArray = SearchString.split('&');
        for(var i = 0; i < VariableArray.length; i++){
            var KeyValuePair = VariableArray[i].split('=');
            if(KeyValuePair[0] == VarSearch){
                return KeyValuePair[1];
            }
        }
    }

    var authenticateSession = function()
    {
        // Get session key from cookie
        var sessionKey = localStorage['session'];

        // If there is a session, authenticate
        if (sessionKey && sessionKey != "null")
            CORELINK.auth({key: sessionKey});
        else
            setLoggedOutState();
    }
    BROWSER.authenticateSession = authenticateSession;

    var logout = function()
    {
        setLoggedOutState();
        localStorage['session'] = null;
    }

    BROWSER.storeSessionKey = function(key)
    {
        localStorage['session'] = key;
    }

    BROWSER.processLinkDestroyed = function(p)
    {
        VIEWER.deleteLink(p.l._id);
    }

    BROWSER.getHubColour = function()
    {
        if (hub.colour)
            return hub.colour;
        else
            return null;
    }

    BROWSER.updateAddressIndicator = function(h)
    {
        if (h._n)
        {
            document.getElementById('addressIndicator').style.visibility = "visible";
            document.getElementById('addressIndicator').innerHTML = '~' + h._t + '.' + h._n;
            VIEWER.updateHolonicAddressPosition();
        }
        else
        {
            document.getElementById('addressIndicator').style.visibility = "hidden";
        }
    }

    BROWSER.processReceivedHolarchyPacket = function(p)
    {
        if (p.l && p.l.length == undefined)
        {
            var l = BROWSER.cache.l[p.l._id];

            if (l)
            {
                for (attrib in p.l)
                    if (attrib != '_id')
                        l[attrib] = p.l[attrib];

                VIEWER.processLinkUpdate(l._id);
            }
        }

        if (p.h && p.h.length == undefined)
        {
            var h = BROWSER.cache.h[p.h._id];

            if (h)
            {
                for (attrib in p.h)
                    if (attrib != '_id')
                        h[attrib] = p.h[attrib];

                VIEWER.processHolonUpdate(p.h);

                if (p.h.read)
                    INFOPANEL.updateUnreadTotal();

                if (p.h._ty == "_w")
                    INFOPANEL.updateNewsfeedUnreadTotal();

                if (h._id == INFOPANEL.getCurrentHolonId() && (p.h.t || p.h.d || p.h.r || p.h._t))
                    INFOPANEL.updateContent();
            }
        }

        var h = p.h[0];

        // PHASE 1
        // Received requested target holon (holarchy root)
        if (requesting &&
            p.h && !p.l && p.h.length == 1 && ( (typeof requesting == "string" && p.h[0]._id == requesting) || (p.h[0]._t == requesting[0] && p.h[0]._n == requesting[1]) ) )
        {
            var h = p.h[0];
            
            BROWSER.cache.h[h._id] = h;

            VIEWER.view_holon(h._id);

            BROWSER.rootHolon = h;
            
            if (BROWSER.cache.h[h._id]._a)
                VIEWER.setHolonActivity(h._id, BROWSER.cache.h[h._id]._a);

            document.getElementById('addressIndicator').style.visibility = "visible";
            BROWSER.updateAddressIndicator(h);
        }
        else
        {
            // PHASE 2 and 3
            if (p.h)
            {
                var activeCommentUpdated = false;
                var contentChanged = false;

                for (var i = p.h.length - 1; i >= 0; i--)
                {
                    var h = p.h[i];

                    if (!h)
                        continue;
                    
                    var hCached = BROWSER.cache.h[h._id];

                    if (hCached)
                    {
                        for (attrib in h)
                            if (attrib != '_id')
                                hCached[attrib] = h[attrib];
                    }
                    else
                    {
                        BROWSER.cache.h[h._id] = h;
                    }   

                    if (BROWSER.cache.h[h._id]._a)
                        VIEWER.setHolonActivity(h._id, BROWSER.cache.h[h._id]._a);

                    if (INFOPANEL && h._id == INFOPANEL.getCurrentHolonId() && (h.t || h.d || h.r))
                    {
                        contentChanged = true;
                    }

                    // If it's a comment
                    if (h._ti)
                    {
                        if (h._ti == INFOPANEL.getCurrentHolonId())
                            activeCommentUpdated = true;

                        var sh = VIEWER.getSelectedHolon();
                        if (h._t == "_r" && sh && h._ti == sh._id ) // 
                        {
                            resonanceChanged = h._ti;
                        }

                        if (BROWSER.cache.h[h._ti])
                        {
                            if (!BROWSER.cache.h[h._ti].__c)
                                BROWSER.cache.h[h._ti].__c = [];

                            if (BROWSER.cache.h[h._ti].__c.indexOf(h._id) == -1)
                                BROWSER.cache.h[h._ti].__c.push(h._id);
                        }
                    }

                    if (Object.keys(h).length == 2 && h.r != undefined)
                    {
                        resonanceChanged = h._id;
                    }

                    // Holon type
                    if (h._t == "_t" && (h.tid == "_t" || (h.t && h.tid && h.rgb)))
                    {
                        var ct = [];

                        if (h.ct)
                            if (typeof h.ct == "string")
                                ct = h.ct.split(',');
                            else
                                ct = h.ct;

                        ontology[h.tid] = {t: h.t, rgb: h.rgb, ct: ct, cmi: h.cmi};

                        if (h.d && (h.tid == "xcl" || h.tid == "xcc" || h.tid == "xcr"))
                        {
                            ontology[h.tid].d = h.d;

                            ontology[h.tid].d = ontology[h.tid].d.replace('<p>', '');
                            ontology[h.tid].d = ontology[h.tid].d.replace('</p>', '');
                            ontology[h.tid].d = ontology[h.tid].d.replace(/[\s"\[\]]/g, '');
                            ontology[h.tid].d = ontology[h.tid].d.split(",");

                            if (ontology[h.tid].d.length == 0)
                                ontology[h.tid].d = null;
                        }

                        if (h._b)
                            ontology[h.tid].bg = h._b;

                        if (!h.cmi)
                            delete ontology[h.tid].cmi;

                        if (h.ae)
                            ontology[h.tid].ae = h.ae;

                        if (h.ad)
                            ontology[h.tid].ad = h.ad;

                        VIEWER.cacheHolonTypeColour(h.tid, h.rgb);
                    }

                    if (p.up)
                        VIEWER.processHolonUpdate(h);
                };

                if (p.h.length == 0 && p._id)
                {
                    if (BROWSER.cache.h[p._id] && !BROWSER.cache.h[p._id].__c)
                        BROWSER.cache.h[p._id].__c = [];

                    if (p._id == INFOPANEL.getCurrentHolonId())
                        activeCommentUpdated = true;
                }

                if (activeCommentUpdated && INFOPANEL) 
                {
                    INFOPANEL.updateComments(BROWSER.cache.h[p._id]);
                }

                if (contentChanged)
                {
                    INFOPANEL.updateContent();
                }
            }

            if (p.l)
            {
                var contentChanged = false;

                for (var i = p.l.length - 1; i >= 0; i--)
                {
                    var l = p.l[i];

                    var lCached = BROWSER.cache.l[l._id];

                    if (lCached)
                    {
                        for (attrib in l)
                            if (attrib != '_id')
                                lCached[attrib] = l[attrib];
                    }
                    else
                    {
                        BROWSER.cache.l[l._id] = l;
                    }

                    // Store link id in parent holon
                    if (BROWSER.cache.h[l._ti])
                    {
                        if (!BROWSER.cache.h[l._ti].__l)
                            BROWSER.cache.h[l._ti].__l = [];

                        if (BROWSER.cache.h[l._ti].__l.indexOf(l._id) == -1)
                            BROWSER.cache.h[l._ti].__l.push(l._id);
                    }

                    // Store parent holon id in child holon
                    if (BROWSER.cache.h[l._fi])
                    {
                        if (!BROWSER.cache.h[l._fi].__ph)
                            BROWSER.cache.h[l._fi].__ph = [];

                        if (BROWSER.cache.h[l._fi].__ph.indexOf(l._ti) == -1)
                            BROWSER.cache.h[l._fi].__ph.push(l._ti);
                    }

                    if (!EMBEDDED && l._ti == INFOPANEL.getCurrentHolonId())
                        contentChanged = true;

                    VIEWER.processLinkUpdate(l._id, p.pp);
                };

                if (contentChanged)
                    INFOPANEL.updateContent();
            }
        }

        if (BROWSER.waitingForLinkedHolon && p.h && p.l && p.h.length == 1 && p.l.length == 1)
        {
            if (p.l[0]._ti == BROWSER.waitingForLinkedHolon[1] && p.h[0]._t == BROWSER.waitingForLinkedHolon[0])
            {
                INFOPANEL.editContent(BROWSER.cache.h[p.h[0]._id]);
                BROWSER.waitingForLinkedHolon = null;

                setTimeout(function()
                {
if (BROWSER.targetHolon && BROWSER.targetHolon._alm)
                    VIEWER.autoLayoutChildHolons();
                
                },1000)
            }
        }
    }

    ////    

    function createCookie(name,value,days)
    {
        if (days) {
        var date = new Date();
        date.setTime(date.getTime()+(days*24*60*60*1000));
        var expires = "; expires="+date.toGMTString();
        }
        else var expires = "";
        document.cookie = name+"="+value+expires+";domain=.holomap.io;path=/"; // domain=.holomap.io;
    }
    BROWSER.createCookie = createCookie;

    function getCookie(c_name)
    {
    var i,x,y,ARRcookies=document.cookie.split(";");
    for (i=0;i<ARRcookies.length;i++)
    {
      x=ARRcookies[i].substr(0,ARRcookies[i].indexOf("="));
      y=ARRcookies[i].substr(ARRcookies[i].indexOf("=")+1);
      x=x.replace(/^\s+|\s+$/g,"");
      if (x==c_name)
        {
        return unescape(y);
        }
      }
    }
    BROWSER.getCookie = getCookie;

    ////

	if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = BROWSER;
        }
        exports.BROWSER = BROWSER;
    } else if (typeof define !== 'undefined' && define.amd) {
        define(BROWSER);
    } else {
        root.BROWSER = BROWSER;
    }


}).call(this);