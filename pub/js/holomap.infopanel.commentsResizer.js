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

    var RESIZER = {};
    var root = this;

    var defaultHeight;
	var minSize;
    var onPanelResized;

    RESIZER.init = function(_defaultHeight, _minSize, opr)
    {
    	defaultHeight = _defaultHeight;
    	minSize = _minSize;
    	onPanelResized = opr;

		/////////////////////////////////////////////////////////////////////////
		// Generic Resize by Erik Arvidsson                                    //
		//                                                                     //
		// You may use this script as long as this disclaimer is remained.     //
		// See www.dtek.chalmers.se/~d96erik/dhtml/ for mor info               //
		//                                                                     //
		// How to use this script!                                             //
		// Link the script in the HEAD and create a container (DIV, preferable //
		// absolute positioned) and add the class="resizeMe" to it.            //
		/////////////////////////////////////////////////////////////////////////

		// Thank you to Erik Avidsson - this is a modified version of his script. - Chris. 

		var theobject;


		RESIZER.maximise = function()
		{
			document.getElementById('infoPanelInfoContentAttributes').style.height = "0px";
			document.getElementById('infoPanelInfoContentComments').style.height = (window.innerHeight - 230) + "px";
		}
		RESIZER.minimise = function()
		{
			document.getElementById('infoPanelInfoContentAttributes').style.height = window.innerHeight - 75 + "px";
		}
		
		RESIZER.minimise();

		RESIZER.invertMinMax = function()
		{
			if (document.getElementById('infoPanelInfoContentAttributes').style.height == "0px")
				RESIZER.minimise();
			else
				RESIZER.maximise();
		}

		minMaxCommentsAndCocreation = RESIZER.invertMinMax;

		RESIZER.displaySpecificComment = function()
		{
			document.getElementById('infoPanelInfoContentAttributes').style.height = "130px";
			document.getElementById('infoPanelInfoContentComments').style.height = (window.innerHeight - 360) + "px";
		}

		function resizeObject() {
			this.el        = null; //pointer to the object
			this.dir    = "";      //type of current resize (n, s, e, w, ne, nw, se, sw)
			this.grabx = null;     //Some useful values
			this.graby = null;
			this.width = null;
			this.height = null;
			this.left = null;
			this.top = null;
		}

		//Find out what kind of resize! Return a string inlcluding the directions
		function getDirection(el) {
			var xPos, offset, dir;
			dir = "";
			yPos = window.event.offsetY;
			offset = 20; //The distance from the edge in pixels
			if (yPos<offset) dir += "n";
			return dir;
		}

		function doDown() {

			var x,y;

			x = window.event.clientX;
			y = window.event.clientY;

			var el = getReal(event.srcElement, "className", "resizeMe2");

			globalEl = el;

			if (el == null) {
				theobject = null;
				return;
			}		

			dir = getDirection(el);
			if (dir == "") return;

			theobject = new resizeObject();
				
			theobject.el = el;
			theobject.dir = dir;
			theobject.grabx = x
			theobject.graby = y
			theobject.width = el.offsetWidth;
			theobject.height = el.offsetHeight;
			theobject.left = el.offsetLeft;
			theobject.top = el.offsetTop;
			window.event.returnValue = false;
			window.event.cancelBubble = true;
		}

		function doUp() {
			if (theobject != null) {
				theobject = null;
			}
		}

		function doMove()
		{
            document.getElementById('infoPanelInfoCommentsSeparator').style.cursor = "row-resize";

			//Dragging starts here
			if(theobject != null) {

				var xMin = 8; //The smallest width possible
				var yMin = minSize; //             height

				var yMax = window.innerHeight / 3;
				var x, y;

				x = window.event.clientX;
				y = window.event.clientY;

				if (dir.indexOf("n") != -1) {
					y = Math.max( Math.min(y , window.innerHeight - 30  )   , 275);
					document.getElementById('infoPanelInfoContentAttributes').style.height = (y) + "px";
					document.getElementById('infoPanelInfoContentComments').style.height = (window.innerHeight - y - 30) + "px";
				}
				
				window.event.returnValue = false;
				window.event.cancelBubble = true;
			} 
		}

		function getReal(el, type, value) {
			temp = el;
			while ((temp != null) && (temp.tagName != "BODY")) {
				if (eval("temp." + type) == value) {
					el = temp;
					return el;
				}
				temp = temp.parentElement;
			}
			return el;
		}

		document.getElementById('infoPanelInfoCommentsSeparator').onmousedown = doDown;
		document.getElementById('infoPanelInfoContent').onmousemove = doMove;
		document.getElementById('infoPanelInfoContent').onmouseup = doUp;
    }

    RESIZER.reinit = function(newHeight)
    {	
    	if (!newHeight)
    		newHeight = defaultHeight;
    	RESIZER.init(newHeight, minSize, onPanelResized)
    }

    ////    

	if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = RESIZER;
        }
        exports.RESIZER = RESIZER;
    } else if (typeof define !== 'undefined' && define.amd) {
        define(RESIZER);
    } else {
        root.RESIZER = RESIZER;
    }
}).call(this);