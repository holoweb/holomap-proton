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

    RESIZER.el = null;
    var defaultWidth;

	var minSize;
    var onPanelResized;

    RESIZER.init = function(_defaultWidth, _minSize, opr)
    {
    	defaultWidth = _defaultWidth;
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
			xPos = window.event.offsetX;
			offset = 20; //The distance from the edge in pixels
			if (xPos<offset) dir += "w";
			return dir;
		}

		function doDown() {
			var x,y;
			x = window.event.clientX;
			y = window.event.clientY;
			var el = getReal(event.srcElement, "className", "resizeMe");
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
			theobject.height = "100%";
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
			document.getElementById('infoPanelDividerBar').style.cursor = "col-resize";

			//Dragging starts here
			if(theobject != null) {
				var xMin = minSize; //The smallest width possible
				var yMin = 8; //             height
				var xMax = window.innerWidth - 624;
				var x, y;

				x = window.event.clientX;
				y = window.event.clientY;

				if (dir.indexOf("w") != -1) {
					var l = Math.max(Math.min(theobject.left + x - theobject.grabx, theobject.left + theobject.width - xMin), theobject.left + theobject.width - xMax);
					var w = Math.min(xMax, Math.max(xMin, theobject.width - x + theobject.grabx));

					theobject.el.style.left = l + "px";
					theobject.el.style.width = (w) + "px";
					console.log(l,w)
					theobject.el.style.height = "100%";
					
					RESIZER.el = theobject.el;
					RESIZER.el.left = l;
					onPanelResized(w);
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

		document.getElementById('infoPanelDividerBar').onmousedown = doDown;
		document.onmouseup   = doUp;
		document.onmousemove = doMove;
    }

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