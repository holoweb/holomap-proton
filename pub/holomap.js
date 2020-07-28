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

if (!EMBEDDED)
{
	require([""+'/socket.io/socket.io.js', "js/holomap.viewer.js", "lib/pixi.js", "lib/TweenMax.min.js", "lib/ColorPropsPlugin.min.js", "js/holomap.corelink.js", "js/holomap.infopanel.js", "js/holomap.browser.js"], function(m0,m1,m2,m3,m4,m5,m6,m7)
	{
		// Define general modules
		io = m0;
		PIXI = m2;

		// Define modules
		var VIEWER = m1;
		var CORELINK = m5;
		var INFOPANEL = m6;
		var BROWSER = m7;

		// Initialise
		BROWSER.init(VIEWER, CORELINK, INFOPANEL);
	});
}
else
{
	require([""+'/socket.io/socket.io.js', "js/holomap.viewer.js", "lib/pixi.js", "lib/TweenMax.min.js", "lib/ColorPropsPlugin.min.js", "js/holomap.corelink.js", "js/holomap.browser.js"], function(m0,m1,m2,m3,m4,m5,m6,m7)
	{
		// Define general modules
		io = m0;
		PIXI = m2;

		// Define modules
		var VIEWER = m1;
		var CORELINK = m5;
		var BROWSER = m6;

		// Initialise
		BROWSER.init(VIEWER, CORELINK, null);
	});
}