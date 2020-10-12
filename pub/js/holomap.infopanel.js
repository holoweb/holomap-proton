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

    var INFOPANEL = {};
    var root = this;
    var RESIZER, VIEWER, BROWSER, RESIZER2;

    var width;
    var minSize;
    var headerHeight;
    var currentHolon;
    var editMode;
    var editingHolon;
    var defaultTabContent;
    var currentTab;
    var mode;
    var conversations;
    var showComment;
    var ifm, infoPanelChildren;

    // Functions

    INFOPANEL.init = function(_VIEWER, _BROWSER, _CORELINK)
    {
        console.log("INFOPANEL init")

        VIEWER = _VIEWER;
        BROWSER = _BROWSER;
        CORELINK = _CORELINK;

        minSize = 332;
        width = Math.min(500, window.innerWidth - 624);
        ratio = width / self.innerWidth;
        editMode = false;
        defaultTabContent = new Object();
        showComment = null;

        defaultTabContent['content'] = '<div id="infoPanelInfoContentControls"><div style="display:none">Slide <big>1</big> of <big>1</big></div><div id="infoPanelInfoEditButton"><img src="/img/edit.png"></img></div><div id="infoPanelInfoSettingsButton"><img src="/img/settings.png"></img></div></div><div id="infoPanelInfoContent"><div id="infoPanelInfoContentAttributes"></div><div class="resizeMe2"><div id="infoPanelInfoCommentsSeparator"><a href="javascript:minMaxCommentsAndCocreation();" style="color:white;">Social</a></div><div id="infoPanelInfoContentComments" ></div></div></div>';
        INFOPANEL.loadTab('content');

        // Require modules
        require(["js/holomap.infopanel.resizer.js", "js/holomap.infopanel.commentsResizer.js"], function(m, m2)
        {
            RESIZER = m;
            RESIZER.init(width, minSize, onPanelResized);
            positionInfoPanel();
            document.getElementById('simple').style.visibility = "visible";
            RESIZER2 = m2;
            RESIZER2.init(400, 200, function(){});
        });
        
        window.addEventListener('resize', onWindowResize, false);

        linkItButtonClicked = function(id)
        {
            var tih;

            if (BROWSER.targetHolon && VIEWER.canEdit(BROWSER.targetHolon) )
                tih = BROWSER.targetHolon;

            if (tih)
            {
                var ch = BROWSER.cache.h[id];
                if (ch && (!ch.t || ch.t == ""))
                    CORELINK.emit('change_holon', { h: {_id: id, t: ch.d.substr(0,150).trim() } } );

                CORELINK.emit('create_link', {
                _fi: id,
                _ti: tih._id,
                l: {
                    x: 0,
                    y: 0,
                    s: 0.1
                }
                 } );
            }
        }

        Array.prototype.remove = function(from, to) {
          var rest = this.slice((to || from) + 1 || this.length);
          this.length = from < 0 ? this.length + from : from;
          return this.push.apply(this, rest);
        };

        removeButtonClicked = function(cid)
        {
            if (confirm("Are you sure you want to remove this comment?\n\nNote: the (comment) holon itself will not be deleted, and will remain accessible by its creator."))
            {
                var h = BROWSER.cache.h[cid];
                var ph = BROWSER.cache.h[h._ti];
                h._ti = "";
                ph.__c.remove( ph.__c.indexOf(cid) );
                updateComments(ph);
                CORELINK.emit('change_holon', { h: {_id: cid, _ti: 'removed' } } );
            }
        }

        loadMeHolonForUsername = function(username)
        {
            BROWSER.getHolarchyByAddress("profile."+username);
        }

        removeAccess = function(id, username)
        {
            var holon = BROWSER.cache.h[id];

            if (holon)
            {
                var pa;
    
                if (holon._pa)
                {
                    pa = [].concat(holon._pa);
                    pa.remove( pa.indexOf(username) );
                    CORELINK.emit('change_holarchy_permission', {_id: holon._id, _u: BROWSER.username, v: username, ty:'a_del'})
                    document.getElementById('addAccessArea').innerHTML = "&nbsp; <img src='/img/loading.gif'></img> <i>requesting...</i>";
                }
            }
        }

        removeEditor = function(id, username)
        {
            var holon = BROWSER.cache.h[id];

            if (holon)
            {
                var pe;
    
                if (holon._pe)
                {
                    pe = [].concat(holon._pe);
                    pe.remove( pe.indexOf(username) );
                    CORELINK.emit('change_holarchy_permission', {_id: holon._id, _u: BROWSER.username, v: username, ty:'e_del'})
                    document.getElementById('addEditorsArea').innerHTML = "&nbsp; <img src='/img/loading.gif'></img> <i>requesting...</i>";
                }
            }
        }

        deleteUrl = function(i)
        {
            if (currentHolon.urls) // check
            {
                updateHolonUrlsVar();
                currentHolon.urls.splice(i, 1);
                updateURLArea(currentHolon);
            }
        }

        deleteVid = function(i)
        {
            if (currentHolon.vids) // check
            {
                updateHolonVidsVar();
                currentHolon.vids.splice(i, 1);
                updateVidsArea(currentHolon);
            }
        }

        // Cropping

        var el = document.getElementById('vanilla-demo');
		vanilla = new Croppie(el, {
			viewport: { width: 600, height: 600, type:"circle" },
			boundary: { width: 700, height: 700 },
			showZoomer: false
		});

		resizeAndUpload = function(file)
		{
			document.getElementById("cropArea").style.visibility = "visible";
			var reader = new FileReader();
			reader.onloadend = function()
			{
				var tempImg = new Image();
				tempImg.src = reader.result;
				tempImg.onload = function()
				{
					vanilla.bind({
						url: tempImg.src,
						orientation: 4
					});
				}
		   }
		   reader.readAsDataURL(file);
        }
        
    }

    var updateHolonUrlsVar = function()
    {   
        if (currentHolon && currentHolon.urls)
        {for (var i = 0; i < currentHolon.urls.length; i++)
        {
            if (document.getElementById('url'+i))
            {
                currentHolon.urls[i] = document.getElementById('url'+i).value;
            }
        };}
    }

    var updateHolonVidsVar = function()
    {   
        if (currentHolon && currentHolon.vids)
        {for (var i = 0; i < currentHolon.vids.length; i++)
        {
            if (document.getElementById('vid'+i))
            {
                currentHolon.vids[i] = document.getElementById('vid'+i).value;
            }
        };}
    }

    INFOPANEL.iframeMode = function(url)
    {
        if (url && !ifm)
        {
            ifm = true;

            infoPanelChildren = [document.getElementById("infoPanelMain").children[0], document.getElementById("infoPanelMain").children[1]];
			
			document.getElementById("infoPanelMain").removeChild(infoPanelChildren[0]);
            document.getElementById("infoPanelMain").removeChild(infoPanelChildren[1]);

            var iframe = document.createElement('iframe');
            iframe.frameBorder=0;
            iframe.width="100%";
            iframe.height="100%";
            iframe.setAttribute("src", url);
            document.getElementById("infoPanelMain").appendChild(iframe);
        }
        else if (!url && ifm)
        {
            ifm = false;

            document.getElementById("infoPanelMain").removeChild(document.getElementById("infoPanelMain").children[0]);
            document.getElementById("infoPanelMain").appendChild(infoPanelChildren[0]);
            document.getElementById("infoPanelMain").appendChild(infoPanelChildren[1]);
        }
    }
    INFOPANEL.inIframeMode = function()
    {
        return ifm;
    }

    INFOPANEL.isEditing = function()
    {
        return editMode;
    }

    INFOPANEL.getMode = function()
    {
        return mode;
    }

    INFOPANEL.getCurrentWidth = function()
    {
        return width;
    }

    INFOPANEL.loadTab = function(tab)
    {
        currentTab = tab;

        if (defaultTabContent[tab])
            document.getElementById('infoPanelMain').innerHTML = defaultTabContent[tab];

        if (tab == "search")
        {
            displaySearch();
        }
        else if (tab == "content")
        {
            document.getElementById('infoPanelInfoEditButton').style.cursor = 'hand';
            document.getElementById('infoPanelInfoEditButton').onclick = function()
            {
                if (BROWSER.username)
                {
                    if (currentHolon)
                    {
                        if (VIEWER.canEdit(currentHolon))
                            INFOPANEL.editContent(currentHolon);
                    }
                    else if (BROWSER.targetHolon && VIEWER.canEdit(BROWSER.targetHolon))
                    {
                        INFOPANEL.editContent(BROWSER.targetHolon);
                    }
                }
            }

            document.getElementById('infoPanelInfoSettingsButton').onclick = function()
            {
                if (BROWSER.username)
                {
                    if (currentHolon)
                        displaySettings(currentHolon);
                    else if (BROWSER.targetHolon)
                        displaySettings(targetHolon);
                }
            }

            if (VIEWER.getSelectedHolon())
                updateContent(VIEWER.getSelectedHolon());
            else if (BROWSER.targetHolon)
                updateContent(BROWSER.targetHolon);

            if (RESIZER2)
                RESIZER2.reinit();

            if (RESIZER2 && showComment)
                RESIZER2.displaySpecificComment();

        }
    }

    function timeSince(date, dateTo, afterWord)
    {
        if (!afterWord && afterWord != "")
            afterWord = " ago";

        if (!dateTo)
            dateTo = new Date();

        var seconds = Math.floor((dateTo - date) / 1000);
        var interval = Math.floor(seconds / 31536000);

        if (interval > 1) {
            return interval + " years" + afterWord;
        }
        interval = Math.floor(seconds / 2592000);
        if (interval > 1) {
            return interval + " months" + afterWord;
        }
        interval = Math.floor(seconds / 86400);
        if (interval > 1) {
            return interval + " days" + afterWord;
        }
        interval = Math.floor(seconds / 3600);
        if (interval > 1) {
            return interval + " hours" + afterWord;
        }
        interval = Math.floor(seconds / 60);
        if (interval > 1) {
            return interval + " minutes" + afterWord;
        }
        return "just now";
    }

    var startSearch = INFOPANEL.startSearch = function()
    {
        var query = document.getElementById('searchQuery').value;
        CORELINK.emit("search", query);
        document.getElementById('searchQuery').value = "";
    }

    var displaySearchResults = INFOPANEL.displaySearchResults = function(results)
    {
        var html = "<div style='font-family: archivo_regular, sans-serif; margin-top: 0px'>";

        var holon = currentHolon;

        if (!holon)
            holon = BROWSER.targetHolon;

        goToSearchResult = function(id)
        {
            INFOPANEL.loadTab('content');
            BROWSER.getHolarchyById(id);
        }

        results.sort(function(a,b){return b._syn - a._syn});

        var ontology = BROWSER.getOntology();

        var total =0;
        html += "<h3>Holons</h3>";

        for (var i = 0; i < results.length; i++)
        {
            var h = results[i];
            var cid = h._id;

            if (h._ti)
                continue;

            total++;

            var linkIt;
            if (VIEWER.canEdit(holon))
            {
                linkIt = "&nbsp; &bullet; &nbsp; <input type='button' value='link it!' class='miniButton' onclick='javascript:linkItButtonClicked(\"" + cid + "\")'></input>";
            }
            else
            {
                linkIt = '';
            }

            var commentContent;
            if (h.t)
                commentContent = "<h3>"+h.t +"</h3>"+h.d;
            else
                commentContent = h.d;    

            var extraBorder = "";
            if (showComment && showComment == h._id)
                extraBorder = "border-width: 3px; ";

            var commentExtra = "";

            if (ontology[h._t])
            {
                html += "<div onclick='goToSearchResult(\""+ h._id +"\")' id='comment_"+h._id+"' class='comment' style='cursor: hand; "+extraBorder+"background: rgba(" + ontology[h._t].rgb +",0.15)'> <div style='float:left'><img src='/img/user/thumb/"+ h._u + ".png'></div> <div class='commentTypeLabel' style='background: rgba(" + ontology[h._t].rgb +",0.3); float:left'>" + ontology[h._t].t + " " + linkIt + "</div> <div style='clear:both; text-align: left;'><b><a href='#' style='color:yellow; text-shadow: 0 0 0.1em #000' onclick='loadMeHolonForUsername(\""+ h._u +"\")'>" + h._u + "</a></b> <small> &nbsp; " + timeSince(new Date(h._tc)) + "</small><hr>" + processMessage(commentContent) + "</div></div>";
            }
            else
            {
                console.log("ERROR: ontology data missing for type", h._t);
            }

            html += "<br>";
        };

        if (total == 0)
            html += "<small>No results to display</small>"

        html += "<h3>Comment Holons</h3>";

        total =0;
        for (var i = 0; i < results.length; i++)
        {
            var h = results[i];
            var cid = h._id;

            if (!h._ti)
                continue;

            total++;

            var linkIt;
            if (VIEWER.canEdit(holon))
            {
                linkIt = "&nbsp; &bullet; &nbsp; <input type='button' value='link it!' class='miniButton' onclick='javascript:linkItButtonClicked(\"" + cid + "\")'></input>";
            }
            else
            {
                linkIt = '';
            }

            var commentContent;
            if (h.t)
                commentContent = "<h3>"+h.t +"</h3>"+h.d;
            else
                commentContent = h.d;    

            var extraBorder = "";
            if (showComment && showComment == h._id)
                extraBorder = "border-width: 3px; ";

            html += "<div onclick='goToSearchResult(\""+ h._id +"\")' id='comment_"+h._id+"' class='comment' style='cursor: hand; "+extraBorder+"background: rgba(" + ontology[h._t].rgb +",0.15)'> <div style='float:left'><img src='/img/user/thumb/"+ h._u + ".png'></div> <div class='commentTypeLabel' style='background: rgba(" + ontology[h._t].rgb +",0.3); float:left'>" + ontology[h._t].t + " " + linkIt + "</div> <div style='clear:both; text-align: left;'><b><a href='#' style='color:yellow; text-shadow: 0 0 0.1em #000' onclick='loadMeHolonForUsername(\""+ h._u +"\")'>" + h._u + "</a></b> <small> &nbsp; " + timeSince(new Date(h._tc)) + "</small><hr>" + processMessage(commentContent) + "</div></div>";

            html += "<br>";
        };

        if (total == 0)
            html += "<small>No results to display</small>"

        html +="</div"

        document.getElementById('searchResultsArea').innerHTML = html;
    }

    var displaySearch = function()
    {
        mode = "search";

        var html = "";

        html += "<div style='position: absolute; top: 17px; width:100%; text-align: center;'><form action='javascript:'><input id='searchQuery' type='text' style='width:70%'></input><input id='searchButton' type='submit' value='Search' class='miniButton'></input></form></div>";
        html += "<div style='position: absolute; top: 50px; width:100%; text-align: center;'><hr></div>";
        html += "<div style='position: absolute; top: 60px; width:calc(100% - 12px); text-align: center; overflow-y: auto; height: calc(100% - 120px)'><div id='searchResultsArea' style='padding: 20px;  '>";
        html += "</div></div>";

        document.getElementById('infoPanelMain').innerHTML = html;

        document.getElementById('searchButton').onclick = function()
        {
            startSearch();   
        }
    }

    var displaySettings = function(holon)
    {
        mode = "settings";

        var html = "";
        var addr = "";

        if (holon._n)
            addr = holon._n;

        html += "<h2>Settings</h2>";
        html += "Settings for <i>'"+holon.t+"'</i> ("+ holon._t +") holon.";
        html += "<p><h3>Permissions</h3>";
        html += "<p>&nbsp;<b>Can access:</b> ";

        if (holon._pa && holon._pa.length > 0)
        {
            for (var i = 0; i < holon._pa.length; i++)
            {
                html += holon._pa[i];

                if (BROWSER.username && BROWSER.username == holon._u)
                    html += " <input type='button' value=' x ' class='miniButton' style='width:25px' onclick='javascript:removeAccess(\"" + holon._id + "\",\"" + holon._pa[i] + "\")'></input>";

                if (i != holon._pa.length - 1)
                    html += ", ";
            };
        }
        else
        {
             html +="<i>anyone with a link</i>";
        }

        if (BROWSER.username && BROWSER.username == holon._u)
            html += "<div id='addAccessArea'>&nbsp;<input id='addAccessButton' type='button' value=' + ' class='miniButton' style='width:24px'></input> &larr; <i>add access priviledge</i></div>"

        html +="</p>";

        html += "<p>&nbsp;<b>Can edit:</b> ";

        if (holon._pe && holon._pe.length > 0)
        {
            for (var i = 0; i < holon._pe.length; i++)
            {
                html += holon._pe[i];

                if (BROWSER.username && BROWSER.username == holon._u)
                    html += " <input type='button' value=' x ' class='miniButton' style='width:25px' onclick='javascript:removeEditor(\"" + holon._id + "\",\"" + holon._pe[i] + "\")'></input>";

                if (i != holon._pe.length - 1)
                    html += ", ";
            };
        }
        else
        {
             html +="<i>anyone with a link</i>";
        }

        if (BROWSER.username && BROWSER.username == holon._u)
            html += "<div id='addEditorsArea'>&nbsp;<input id='addEditorButton' type='button' value=' + ' class='miniButton' style='width:24px'></input> &larr; <i>add an editor</i></div>"
        html +="</p>";

        html +="</p>";

        html += "<form action='javascript:'>";

        html += "<p><h3>Holonic address</h3><div style='float: left; white-space:nowrap; '>~"+holon._t+".";

        if (BROWSER.username && VIEWER.canEdit(holon) && ['map','prep','profile'].indexOf(holon._t) == -1)
        {
            html += "</div><input style='white-space:nowrap; width:80%; margin-top: -6px' id='addressInput' placeholder='Enter an id, unique to type "+holon._t+"' type='text' value='" + addr + "'></input></p>";
            html += "<p align='center'> <input id='setAddressButton' type='button' value='Set Address' class='miniButton'></input> </p>";
        }
        else
        {
            if (addr != "")
                html += addr;
            else
                html += " &nbsp; <i>no address set</i>";

            html += "</div></p>";
        }

        html += "</form>";

        document.getElementById('infoPanelInfoContentAttributes').innerHTML = html;

        var v;

        if (document.getElementById('addressInput'))
        {
            document.getElementById('addressInput').value;
            document.getElementById('addressInput').focus();
            document.getElementById('addressInput').value = v;
        }

        if (document.getElementById('setAddressButton'))
        {
            document.getElementById('setAddressButton').onclick = function()
            {
                if (BROWSER.username)
                {
                    var h;

                    if (currentHolon)
                        h = currentHolon;
                    else if (BROWSER.targetHolon)
                        h = targetHolon;

                    var newAddress = document.getElementById('addressInput').value;

                    CORELINK.emit('set_holonic_address', {h: {_id: h._id, _t: h._t, _n: newAddress}});
                }
            }
        }

        $('#addAccessButton').click(function()
        {
            var html = "&nbsp;<input id='ac1' type='text' style='width:30%;' placeholder='Enter username'></input> &nbsp; <input id='requestAddAccessButton' type='button' value='Add User' class='miniButton'></input> <input type='button' value='Cancel' class='miniButton'></input>";

            document.getElementById('addAccessArea').innerHTML = html;

            $('#requestAddAccessButton').click(function()
            {
                var newUser = document.getElementById('ac1').value.toLowerCase();

                if (newUser && newUser != "")
                {
                    if (!holon._pa || (holon._pa && holon._pa.indexOf(newUser) == -1))
                    {

                        document.getElementById('addAccessArea').innerHTML = "&nbsp; <img src='/img/loading.gif'></img> <i>requesting...</i>";

                        var pa;

                        if (holon._pa)
                            pa = [newUser].concat(holon._pa);
                        else
                            pa = [newUser];

                        CORELINK.emit('change_holarchy_permission', {_id: holon._id, _u: BROWSER.username, v: newUser, ty:'a_add'})
                    }
                    else
                    {
                        alert("Error: user already has access permission.");
                    }
                }
                else
                {
                    alert("Error... please specify a username.");
                }
            });
        });

        $('#addEditorButton').click(function()
        {
            var html = "&nbsp;<input id='ed1' type='text' style='width:30%;' placeholder='Enter username'></input> &nbsp; <input id='requestAddEditorButton' type='button' value='Add Editor' class='miniButton'></input> <input type='button' value='Cancel' class='miniButton'></input>";

            document.getElementById('addEditorsArea').innerHTML = html;

            $('#requestAddEditorButton').click(function()
            {
                var newUser = document.getElementById('ed1').value.toLowerCase();

                if (newUser && newUser != "")
                {
                    if (!holon._pe || (holon._pe && holon._pe.indexOf(newUser) == -1))
                    {

                        document.getElementById('addEditorsArea').innerHTML = "&nbsp; <img src='/img/loading.gif'></img> <i>requesting...</i>";

                        var pe;

                        if (holon._pe)
                            pe = [newUser].concat(holon._pe);
                        else
                            pe = [newUser];

                        CORELINK.emit('change_holarchy_permission', {_id: holon._id, _u: BROWSER.username, v: newUser, ty:'e_add'})
                    }
                    else
                    {
                        alert("Error: user already has edit permission.");
                    }
                }
            });
        });
    }
    INFOPANEL.displaySettings = displaySettings;

    INFOPANEL.getCurrentHolonId = function()
    {
        if (currentHolon)
            return currentHolon._id;
        else if (BROWSER && BROWSER.targetHolon)
            return BROWSER.targetHolon._id;
    }

    getCurrentHolon = function()
    {
        if (currentHolon)
            return currentHolon;
        else if (BROWSER.targetHolon)
            return BROWSER.targetHolon;
    }

    searchForHashtag = function(tag)
    {
        INFOPANEL.loadTab("search");
        document.getElementById('searchQuery').value = tag;
        INFOPANEL.startSearch();
    }

    var updateContent = function(holon, changeMode)
    {
        if (!holon)
        {
            if (currentHolon)
                holon = currentHolon
            else
                holon = BROWSER.targetHolon;
        }

        if (INFOPANEL.inIframeMode())
            INFOPANEL.iframeMode(false);

        if (currentTab != 'content') return;

        currentHolon = holon;

        if (mode == "index" && !changeMode && holon)
        {
            displayIndex(holon);
            return;
        }

        mode = "content";
        editMode = false;

        var html = "";
        var attributes = BROWSER.getAttributes();
        var ontology = BROWSER.getOntology();

        if (holon && attributes)
        {
            var typeDef = BROWSER.getOntology(holon._t);
            var ad;

            if (typeDef && typeDef.ad)
                ad = typeDef.ad.split(',');
            else
                ad = ['t','d'];

            // Write HTML

            var nBit = "&nbsp;<br>";
            if (holon._n)
                nBit = "<i>~" + holon._t + "." + holon._n + "&nbsp;</i><br>"; 

            var rBit = "";
            if (holon.r)
                rBit = "<b>+" + holon.r + " R</b>";        


            var typeString = BROWSER.getTypeName(holon._t);

            if (!typeString)
                typeString = "Holon";
            else
                typeString = "<b style='font-size: 25;'>" + typeString + " </b> holon";

            var userString = "";


            var col = 0xFFFFFF;

            var col2;

            if (ontology[holon._t] && ontology[holon._t].rgb)
                col = ontology[holon._t].rgb;
            else
                console.log("missing ontology data for holon type:", holon._t);


            if (holon.dt && ontology[holon.dt] && ontology[holon.dt].rgb)
                col2 = ontology[holon.dt].rgb;

            var bc = '';
            if (col2)
                bc = 'border-color: rgb('+col2+');';


            var style = "";

            style += "background: rgba("+col+",1);"
            style += "background: -moz-linear-gradient(top, rgba("+col+",1) 0%, rgba("+col+",0) 100%);"
            style += "background: -webkit-gradient(left top, left bottom, color-stop(0%, rgba("+col+",1)), color-stop(100%, rgba("+col+",0)));"
            style += "background: -webkit-linear-gradient(top, rgba("+col+",1) 0%, rgba("+col+",0) 100%);"
            style += "background: -o-linear-gradient(top, rgba("+col+",1) 0%, rgba("+col+",0) 100%);"
            style += "background: -ms-linear-gradient(top, rgba("+col+",1) 0%, rgba("+col+",0) 100%);"
            style += "background: linear-gradient(to bottom, rgba("+col+",1) 0%, rgba("+col+",0) 100%);"

            html += "<p style='" + style + "' class='metadata'>" + typeString + userString + ".</p>";

            // Todo: loop through attributes

            for (var i = 0; i < ad.length; i++)
            {
                if (attributes[ad[i]] && holon[ad[i]])
                {
                    var value = holon[ad[i]];

                    if (ad[i] == "t" && holon.dt && ontology[holon.dt])
                        value = ontology[holon.dt].t + ": " + value;

                    if (ad[i] == "tf")
                    {
                        value = "<b>From:</b> " + new Date(value[0]).toString() + "<br><b>To:</b> " + new Date(value[1]).toString();
                    }

                    if (ad[i] == "t")
                    {
                        if (tt[holon._t])
                        {
                            value =  tt[holon._t] + " " + value[0].toLowerCase() + value.substr(1,value.length);
                        }
                    }

                    html += "<p>" + attributes[ad[i]].d.replace('$.$', value) + "</p>";

                    // Append resonance and tags after title
                    if (ad[i]=="t")
                    {

                        if (holon.tags && holon.tags.length > 0)
                        {
                            html += "<p>";

                            for (var j = 0; j < holon.tags.length; j++) {
                                html += "<small><a href='javascript:searchForHashtag(\""+ holon.tags[j] +"\")'>#" + holon.tags[j] + "</a></small> ";
                            };

                            html += "</p>"
                        }
                    }
                }
            };


            if (holon.urls && holon.urls.length > 0)
            {
                html += "<h4>Linked websites:</h4>";
                for (var j = 0; j < holon.urls.length; j++) {
                    html += "&rarr;<a href=\"" + holon.urls[j] + "\" target=\"_new\">" + holon.urls[j] + "</a><br>";
                };
                html += "<br>"
            }

            if (holon.vids && holon.vids.length > 0)
            {
                html += "<h4>Linked videos:</h4>";
                for (var i = 0; i < holon.vids.length; i++)
                {
                    var embedCode = '<iframe width="100%" height="315" src="https://www.youtube.com/embed/'+holon.vids[i]+'" frameborder="0" allowfullscreen></iframe>';

                    html += "<p>"+embedCode+"</p>";
                };
            }

            var d = new Date(holon._tc);

            html += "<p><small style='opacity: 0.5'>Created by <a id='userCreatedByLink' href='javascript:'>" + holon._u + "</a>, " + timeSince(d) + " (" + d.toLocaleDateString() + " at " + d.toLocaleTimeString()  + ")</small></p>"

            var dots = "";
            if (holon.t && holon.t.length > 60)
                dots = "...";
        }

        document.getElementById('infoPanelInfoContentAttributes').innerHTML = html;

        // userCreatedByLink action
        if (document.getElementById('userCreatedByLink'))
        {
            document.getElementById('userCreatedByLink').onclick = function()
            {
                BROWSER.getHolarchyByAddress("profile."+document.getElementById('userCreatedByLink').innerHTML);
            }
        }

        /////
        ///// Comments area
        /////

        html = "";

        if (holon)
        {
            html += "<div style='padding: 5px'>"

            html += "<div id='commentArea' style='text-align:center; opacity: 0.5;'></div>";

            html += "<div style='text-align:center;'><br><br><small><b>Add a comment holon:</b></small></div><br>";

            html += "I have a <select id='commentHolonType' class='commentTypeSelector'>";

            var types = [];

            var ontology = BROWSER.getOntology();

            for (var id in ontology)
            {
                if (ontology[id].cmi)
                {
                    types[ontology[id].cmi-1] = id;
                }
            }

            for (var i = 0; i < types.length; i++)
            {
                if (types[i])
                    html += "<option value='"+types[i]+"'>" + ontology[types[i]].t.toLowerCase() + "</option>";
            };

            html += "</select>&rarr;<div><textarea id='commentInput' style='margin-top: 10px; width: 100%' placeholder=\"What's in your reality?\"></textarea></div>";

            if (!holon.__requestedComments)
            {
                holon.__requestedComments = true;
                CORELINK.emit('get_comments', { h: {_id: holon._id } } );
            }

            html += "</div>";
        }

        document.getElementById('infoPanelInfoContentComments').innerHTML = html;

        updateComments(holon);

        $( "#commentInput" ).keyup(function(e)
        {
            e = e || event;
            
            if (e.keyCode === 13 && !e.shiftKey)
            {
                var message = document.getElementById('commentInput').value;
                var holonType = document.getElementById("commentHolonType").value;
            
                if (message != "\n" && message != "\r")
                {
                    document.getElementById('commentInput').value = 'One moment...';
                    document.getElementById('commentInput').disabled = true;

                    CORELINK.emit('create_comment', { h: {d: message}, _t: holonType, _ti: holon._id } );

                }   
            }
            return true;
        });

    }
    INFOPANEL.updateContent = updateContent;

    updateComments = function(holon)
    {
        if (!holon)
        {
            if (currentHolon)
                holon = currentHolon
            else
                holon = BROWSER.targetHolon;

            // TEMP
            if (document.getElementById('commentInput') && document.getElementById('commentInput').value == 'One moment...')
            {
                document.getElementById('commentInput').value = '';
                document.getElementById('commentInput').disabled = false;
            }
        }

        if (!document.getElementById('commentArea'))
            return;

        var html = "";

        if (holon && holon.__c)
        {
            if (holon.__c.length > 0)
            {
                if (holon.__c.length > 1)
                    s = 's';
                else 
                    s = '';

                html += "<small><b>" + holon.__c.length + " comment"+s+":</b></small><br><br>";

                var ontology = BROWSER.getOntology();

                try{holon.__c.sort(function(a,b){return BROWSER.cache.h[b]._tc - BROWSER.cache.h[a]._tc});
            } catch(e){}

                for (var i = holon.__c.length - 1; i >= 0; i--)
                {
                    var cid = holon.__c[i];
                    var h = BROWSER.cache.h[cid];

                    if (!h)
                        continue;

                    if (h._t == "_r")
                    {
                        html += "<div id='comment_"+h._id+"' class='comment' style='background: rgba(0,0,0,0); border:none;'> <div style='float:left'><img src='/img/user/thumb/"+ h._u + ".png'></div> <div class='commentTypeLabel' style='background: rgba(175,27,207,0.3); float:left'><b><i>resonates!</b></i></div> <div style='clear:both; text-align: left;'><b><a href='#' style='color:yellow; text-shadow: 0 0 0.1em #000' onclick='loadMeHolonForUsername(\""+ h._u +"\")'>" + h._u + "</a></b> <small> &nbsp; " + timeSince(new Date(h._tc)) + "</small></div></div>";

                        html += "<br>";
                    }
                    else
                    {
                        var linkIt;
                        if (VIEWER.canEdit(holon))
                        {
                            linkIt = "&nbsp; &bullet; &nbsp; <input type='button' value='link it!' class='miniButton' onclick='javascript:linkItButtonClicked(\"" + cid + "\")'></input>";
                        }
                        else
                        {
                            linkIt = '';
                        }

                        var removeComment;
                        if (VIEWER.canEdit(holon) || VIEWER.canEdit(h))
                        {
                            removeComment = "&nbsp; <input type='button' value='remove' class='miniButton' onclick='javascript:removeButtonClicked(\"" + cid + "\")'></input>";
                        }
                        else
                        {
                            removeComment = '';
                        }

                        var commentContent;
                        if (h.t)
                            commentContent = "<h3>"+h.t +"</h3>"+h.d;
                        else
                            commentContent = h.d;    

                        var extraBorder = "";
                        if (showComment && showComment == h._id)
                            extraBorder = "border-width: 3px; ";

                        if (ontology[h._t])
                        {
                            html += "<div id='comment_"+h._id+"' class='comment' style='"+extraBorder+"background: rgba(" + ontology[h._t].rgb +",0.15)'> <div style='float:left'><img src='/img/user/thumb/"+ h._u + ".png'></div> <div class='commentTypeLabel' style='background: rgba(" + ontology[h._t].rgb +",0.3); float:left'>" + ontology[h._t].t + " " + linkIt + removeComment + "</div> <div style='clear:both; text-align: left;'><b><a href='#' style='color:yellow; text-shadow: 0 0 0.1em #000' onclick='loadMeHolonForUsername(\""+ h._u +"\")'>" + h._u + "</a></b> <small> &nbsp; " + timeSince(new Date(h._tc)) + "</small><hr>" + processMessage(commentContent) + "</div></div>";
                        }
                        else
                        {
                            console.log("Error: type not found; " + h._t + " " +ontology[h._t]);
                        }

                        html += "<br>";
                    }

                };

                document.getElementById('commentArea').style.opacity = 1;
            }
            else
            {
                html += "<p style='margin-top:10px'> <i><b>No comments here yet.</b> Be the first to comment!</i></p>";
                document.getElementById('commentArea').style.opacity = 0.5;
            }
        }
        else
        {
            console.log("nothing")
            // Get comments
            html += "<img src='/img/loading.gif'></img>";
            document.getElementById('commentArea').style.opacity = 0.5;
        }
        
        document.getElementById('commentArea').innerHTML = html;

        setTimeout(function()
        {
            scrollInfoContentComments();
        },500);
    }
    INFOPANEL.updateComments = updateComments;

    scrollInfoContentComments = function()
    {
        if (document.getElementById('infoPanelInfoContentComments'))
        {
            var d = document.getElementById('infoPanelInfoContentComments');

            var targetHeight;

            if (showComment && $("#comment_"+showComment).offset())
                targetHeight = $("#comment_"+showComment).offset().top - 500;
            else
                targetHeight = d.scrollHeight;

            if (0 && showComment)
            {
                $('#infoPanelInfoContentComments').animate({
                    scrollTop: targetHeight
                }, 500);
            }
            else
            {
                d.scrollTop = targetHeight;
            }

        }
        if (document.getElementById('scrollMessages'))
        {
            var d = document.getElementById('scrollMessages');
            d.scrollTop = d.scrollHeight ;
        }
    }

    var updateURLArea = function(holon)
    {
        var html = "";

        if (holon.urls)
        {
            for (var i = 0; i < holon.urls.length; i++)
            {
                var v = holon.urls[i];
                html += "<input id='url" + i + "' type='text' style='width:80%;' placeholder='Enter URL' value='" + v + "'></input> &nbsp; <input type='button' value='delete' class='miniButton' onclick='javascript:deleteUrl("+i+")'></input><br>";
            };
        }
        html += "<input id='addLinkButton' type='button' value=' + ' class='miniButton' style='width:24px'></input> &larr; <i>click to add a link</i><br><br>";

        document.getElementById('urlArea').innerHTML = html;

        $('#addLinkButton').click(function()
        {
            updateHolonUrlsVar();

            if (!currentHolon.urls)
                currentHolon.urls = [""]
            else
                currentHolon.urls.push("");

            updateURLArea(currentHolon);
        });
    }

    var updateVidsArea = function(holon)
    {
        var html = "";

        if (holon.vids)
        {
            for (var i = 0; i < holon.vids.length; i++)
            {
                var v = holon.vids[i];

               html += "<input id='vid" + i + "' type='text' style='width:80%;' placeholder='Enter YouTube URL, Embed Code or Video ID' value='" + v + "'></input> &nbsp; <input type='button' value='delete' class='miniButton' onclick='javascript:deleteVid("+i+")'></input><br><br>";
            };
        }
        html += "<input id='addVideoButton' type='button' value=' + ' class='miniButton' style='width:24px'></input> &larr; <i>click to add a video</i>";

        document.getElementById('vidsArea').innerHTML = html;

        $('#addVideoButton').click(function()
        {
            updateHolonVidsVar();

            if (!currentHolon.vids)
                currentHolon.vids = [""]
            else
                currentHolon.vids.push("");

            updateVidsArea(currentHolon);
        });

        console.log("Vids >>", holon.vids);
    }

    var tt = {} // {i: "I/We intend to", d: "I/We want", p: "I am / We are passionate about", a: "I am/We are", v: "I/We envision"}

    INFOPANEL.tt = tt;

    INFOPANEL.editContent = function(holon)
    {
        currentHolon = holon;
        mode = "contentedit";
        editMode = true;

        var html = "";
        var attributes = BROWSER.getAttributes();

        html += "<p align='center' style='margin-bottom:20px'><br><input id='saveContentButton' type='button' value='Save Changes' class='saveContentButton'></input></p>";
        html += '<span>Holon background:</span><input type="file" id="userPhotoInput" name="userPhoto" class="button" style="margin: 5px; font-size: 10pt; padding: 5px; background: rgba(0,0,0,0); color: white;" class="inputButton"/>';

        


        if (['map','prep','profile'].indexOf(holon._t) == -1)
        {
            var ontology = BROWSER.getOntology();
            html += "<select id='typeSelector'>"
            for (var type in ontology)
                if (['map','prep','profile','map','hmadmin'].indexOf(type) == -1)
                    html += "<option value='"+type+"' style='background:rgba("+ontology[type].rgb+",0.3)'>" + ontology[type].t + "</option>";
            html += "</select>";
        }


        html += "<form action='javascript:'>";

        if (holon && attributes)
        {
            var typeDef = BROWSER.getOntology(holon._t);
            var ae;

            if (typeDef && typeDef.ae)
                ae = typeDef.ae.split(',');
            else
                ae = ['t','d'];

            var te = "<input id='attr_t' type='text' style='width:98%;' placeholder=''></input>";

            for (var i = 0; i < ae.length; i++)
            {
                if (attributes[ae[i]])
                {
                    if (ae[i] == "t" && tt[holon._t])
                    {
                        html += "<p><h2>" + tt[holon._t] + "...</h2><br>" + te + "</p>";
                    }
                    else if (ae[i] == "d")
                    {
                        html += '<div id="editor-container" style="height:400px"></div>';
                    }
                    else
                    {
                        html += "<p>" + attributes[ae[i]].e + "</p>";
                    }
                }
            };
        }

        html += "<br><p><h4>Hashtags</h4><input id='attr_tags' style='width:98%' type='text' placeholder='Enter tags separated by commas'></input></p>"
        html += "<p><h4>Links (URLs):</h4><div id='urlArea'></div></p>";
        html += "<p><h4>YouTube Videos:</h4><div id='vidsArea'></div></p>";
        html += "<br><p align='center'> <input id='saveContentButton' type='submit' value='Save Changes' class='saveContentButton'></input> </p>";
        html += "</form>";

        document.getElementById('infoPanelInfoContentAttributes').innerHTML = html;

        cancelCrop = function()
        {
            document.getElementById("cropArea").style.visibility = "hidden";
        }

        doCrop = function()
		{
            vanilla.result({type: 'blob', size:{width:800,height:800}, format: 'png', quality: 1, circle: true }).then(function(blob)
            {
				var formData = new FormData();
				formData.append("userPhoto", blob);
		
				var request = new XMLHttpRequest();
				request.onload = function(e)
				{
                    document.getElementById("cropArea").style.visibility = "hidden";
                };
                
                request.onreadystatechange = function()
                {
                    if (request.readyState == XMLHttpRequest.DONE)
                    {
                        var response = JSON.parse(request.responseText);
                        holon._b = response.path;
                        VIEWER.updateHolonBackground(holon);
                        if (holon._t == 'profile')
                            CORELINK.emit('change_holon', { avatar: true, h: {_id: holon._id, _b: response.path } } );
                        else
                            CORELINK.emit('change_holon', { h: {_id: holon._id, _b: response.path } } );
                    }
                }
		
				request.open("POST", "/img/user");
				request.send(formData);
			});
        }
        
        if (window.File && window.FileReader && window.FileList && window.Blob) {
            document.getElementById('userPhotoInput').onchange = function(){
                resizeAndUpload(document.getElementById('userPhotoInput').files[0]);
            };
        } else {
            alert('The File APIs are not fully supported in this browser.');
        }

        updateURLArea(holon);
        updateVidsArea(holon);

        var typeDef = BROWSER.getOntology(holon._t);
        if (document.getElementById("typeSelector"))
            document.getElementById("typeSelector").value = holon._t;


        if (holon && attributes)
        {
            var typeDef = BROWSER.getOntology(holon._t);
            var ae;

            if (typeDef && typeDef.ae)
                ae = typeDef.ae.split(',');
            else
                ae = ['t','d'];

            ae.push('tags');

            for (var i = 0; i < ae.length; i++)
            {
                if (attributes[ae[i]] && holon[ae[i]])
                    if (document.getElementById('attr_'+ae[i]))
                        document.getElementById('attr_'+ae[i]).value = holon[ae[i]];

                if (holon.tags && holon.tags.length > 0 && ae[i] == "tags" && typeof holon.tags == "object")
                    document.getElementById('attr_tags').value = holon.tags.join(', ');

                if (ae[i] == "d" && holon[ae[i]])
                    document.getElementById('editor-container').innerHTML = holon[ae[i]];
            };
        }

        var quill = new Quill('#editor-container', {
            modules: {
              toolbar: [
                [{ header: [1, 2, 3, false] }],
                ['bold', 'italic', 'underline'],
                ['image', 'code-block']
              ]//,htmlEditButton: {}
            },
            placeholder: 'Enter description',
            theme: 'snow'  // or 'bubble'
        });

        $('.saveContentButton').click(function()
        {
            if (holon.urls && holon.urls.length > 0)
            {
                var total = holon.urls.length;
                var urls = [];
                for (var i = 0; i < total; i++)
                {
                    if (document.getElementById('url'+i))
                    {
                        var v = document.getElementById('url'+i).value;
                        if (v != "")
                        {
                            if (!/^(http|ftp|https)/i.test(v,'i'))
                                v = "http://" + v;

                            if (/(http|ftp|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/i.test(v,'i'))
                                urls.push(v);
                        }
                    }
                };
                holon.urls = urls;
            }

            if (holon.vids && holon.vids.length > 0)
            {
                var total = holon.vids.length;
                var vids = [];

                for (var i = 0; i < total; i++)
                {
                    if (document.getElementById('vid'+i))
                    {
                        var v = document.getElementById('vid'+i).value;
                        if (v != "")
                        {
                            var match = v.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=|\/sandalsResorts#\w\/\w\/.*\/))([^\/&]{10,12})/);
                            var idMatch = /^[^\/&]{10,12}$/i.exec(v);

                            if (match && match.length == 2)
                                vids.push(match[1]);
                            else if (idMatch)
                                vids.push(v);
                        }
                    }
                };
                holon.vids = vids;
            }

            var t;
            if (document.getElementById('attr_t'))
                t = document.getElementById('attr_t').value;
            var titleChanged;
            if (t && holon.t != t)
            {
                titleChanged = true;
            }
            
            var attr = {_id: holon._id};

            if (holon.urls) attr.urls = holon.urls;
            if (holon.vids) attr.vids = holon.vids;

            if (document.getElementById('attr_tags') && document.getElementById('attr_tags').value && document.getElementById('attr_tags').value != "")
            {
                holon.tags = document.getElementById('attr_tags').value.split(',');

                for (var k = 0; k < holon.tags.length; k++)
                    holon.tags[k] = holon.tags[k].toLowerCase().replace(/\W/g, '');

                attr.tags = holon.tags;
            }

            var typeDef = BROWSER.getOntology(holon._t);
            var ae;

            if (typeDef && typeDef.ae)
                ae = typeDef.ae.split(',');
            else
                ae = ['t','d'];

            for (var i = 0; i < ae.length; i++)
            {

                if (document.getElementById('attr_'+ae[i]))
                {
                    var v = document.getElementById('attr_'+ae[i]).value;

                    holon[ae[i]] = v;
                    attr[ae[i]] = v;
                }
                else
                {

                    if (ae[i] == "d")
                    {
                        var htmlContent = document.getElementById('editor-container').children[0].innerHTML;

                        holon[ae[i]] = htmlContent;
                        attr[ae[i]] = htmlContent;
                    }

                    if (ae[i] == "tf")
                    {
                        var startDate = $('#ds').datepicker('getDate', new Date());
                        var startTime = $('#ts').timepicker('getTime', new Date());

                        var endDate = $('#de').datepicker('getDate', new Date());
                        var endTime = $('#te').timepicker('getTime', new Date());
                        
                        if (startTime && startDate && endDate && endTime)
                        {
                            startDate.setHours(startTime.getHours());
                            startDate.setMinutes(startTime.getMinutes());
                            endDate.setHours(endTime.getHours());
                            endDate.setMinutes(endTime.getMinutes());

                            var ts = startDate.getTime();
                            var te = endDate.getTime();

                            holon.tf = [ts,te];
                            attr.tf = [ts,te];
                        }
                    }

                }
            }

            if (document.getElementById("typeSelector"))
            {
                if (document.getElementById("typeSelector").value != holon._t)
                {
                    attr._t = document.getElementById("typeSelector").value;
                }
            }

            CORELINK.emit('change_holon', { h: attr } );

            if (titleChanged)
                if (BROWSER.targetHolon._id == holon._id)
                    VIEWER.setHolonTitle(t);
                else
                    VIEWER.updateHolonAnnotation(holon._id);


            updateContent(holon);
        });

        $('#datepairExample .time').timepicker({
            'showDuration': true,
            'timeFormat': 'g:ia',
            'scrollDefault': 'now'
        });

        $('#datepairExample .date').datepicker({
            'format': 'm/d/yyyy',
            'autoclose': true
        });

        $('#datepairExample').datepair();

        if (holon.tf)
        {
            $('#ds').datepicker('setDate', new Date(holon.tf[0]));
            $('#de').datepicker('setDate', new Date(holon.tf[1]));
            $('#ts').timepicker('setTime', new Date(holon.tf[0]));
            $('#te').timepicker('setTime', new Date(holon.tf[1]));
        }

        if (document.getElementById('attr_t'))
            document.getElementById('attr_t').focus();

    }

    var onPanelResized = function(w)
    {
        width = w;
        VIEWER.infoPanelResized(w);
    }

    var onWindowResize = function()
    {
        width = Math.max(minSize, ratio * self.innerWidth);
        positionInfoPanel();
        VIEWER.infoPanelResized(width);
    }
    INFOPANEL.onWindowResize = onWindowResize;

    var positionInfoPanel = function()
    {
        document.getElementById('simple').style.top = 0;
        document.getElementById('simple').style.right = 0 + "px";
        document.getElementById('simple').style.width = width + "px";
        document.getElementById('simple').style.height = "100%";

        if (RESIZER.el)
        {
            RESIZER.el.style.left = (self.innerWidth - width) + "px";
            RESIZER.el.style.width =  width + "px";
            document.getElementById('simple').style.width = RESIZER.el.style.width;
        }
    }

    var replaceURLWithHTMLLinks = function(text)
    {
        var exp = /(\b(https?:\/\/|ftp:\/\/|file:\/\/|www\.)[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
        return text.replace(exp,"<a href='$1' target='_new'><b>$1</b></a>");
    }

    var processLocalLinks = function(m)
    {
        var exp = /\~([a-zA-Z0-9\*]+\.[a-zA-Z0-9]+)/ig;
        return m.replace(exp,"<a href=\"javascript:getHolarchyByAddress('$1')\"><b>~$1</b></a>");
    }

    var processUserLinks = function(m)
    {
        var exp = /\@([a-zA-Z0-9]+)/ig;
        return m.replace(exp,"<a href=\"javascript:getHolarchyByAddress('profile.$1')\"><b>@$1</b></a>");
    }
    
    var processLineBreaks = function(m)
    {
        var exp = /\n\n/ig;
        return m.replace(exp,"<br><br>");
    }

    var processMessage = function(m)
    {
        if (m)
        {
            m = replaceURLWithHTMLLinks(m);
            m = processLocalLinks(m);
            m = processUserLinks(m);
            m = processLineBreaks(m);
        }
        return m;
    }

    ////    

	if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = INFOPANEL;
        }
        exports.INFOPANEL = INFOPANEL;
    } else if (typeof define !== 'undefined' && define.amd) {
        define(INFOPANEL);
    } else {
        root.INFOPANEL = INFOPANEL;
    }


}).call(this);
