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

	var VIEWER = {};
	var root = this;

	var BROWSER, CORELINK, INFOPANEL, RING, NAVBAR;

	var viewWidth = self.innerWidth;
	var viewHeight = self.innerHeight;

	var animSpeed = 0.3;
	var r;
	var targetHolonContainer;
	var holonTrail = [];
	var zooming;
	var renderer, stage;
	var parentHolon, targetHolon, zoomingHolon, selectedHolon, draggingHolon;
	var parentHolons;
	var parentHolonsContainer;
	var circleShade;
	var holonTitle;
	var typeColours = {};
	var frameRate, frameRateTimer;
	var idleTimeInSeconds = 5;
	var copiedLink, justPasted;
	var availableWidth;
	var level;
	var mouseX, mouseY;
	var setAnnotationTimeout;
	var synergiseButton;

	VIEWER.getAvailableWidth = function()
	{
		return availableWidth;
	}

	var updateViewerGeometry = function()
	{
		var availableHeight;

		if (!EMBEDDED)
			availableHeight = viewHeight -BROWSER.geom.headerSize;
		else
			availableHeight = viewHeight;

		VIEWER.geom.diam = Math.min(availableHeight, availableWidth) - 2*(VIEWER.geom.ringSize);
		VIEWER.geom.x = availableWidth/2;

		if (!EMBEDDED)
			VIEWER.geom.y = availableHeight/2 + BROWSER.geom.headerSize;
		else
			VIEWER.geom.y = availableHeight/2;
	}

	VIEWER.init = function(_BROWSER, _CORELINK, _INFOPANEL)
	{
		console.log("VIEWER init");

		BROWSER = _BROWSER;
		CORELINK = _CORELINK;
		INFOPANEL = _INFOPANEL;

		parentHolons = [];

		// Temp - preload image
		var tempSprite = new PIXI.Sprite.fromImage("/img/default.png");

		var w;

		if (EMBEDDED)
			w = 0;
		else
			w = Math.min(500, window.innerWidth - 624);

		if (INFOPANEL)
			w = INFOPANEL.getCurrentWidth();

		availableWidth = viewWidth - w;

		// Set viewer geometry
		VIEWER.geom = { ringSize: 55, margin: 60};
		updateViewerGeometry();

		// Create a pixi renderer
		renderer = PIXI.autoDetectRenderer(viewWidth, viewHeight, {transparent: true, antialias: true});
		renderer.view.className = "rendererView";
		VIEWER.renderer = renderer;
		
		// add render view to DOM
		document.getElementById('main').appendChild(renderer.view);
		renderer.view.style['z-index'] = 1;

		// create an new instance of a pixi stage
		stage = new PIXI.Stage(0x000000);
		VIEWER.stage = stage;

		// Create container to hold target holon and child holons of target holon
		targetHolonContainer = new PIXI.DisplayObjectContainer();
		targetHolonContainer.position.x = VIEWER.geom.x;
		targetHolonContainer.position.y = VIEWER.geom.y;
		stage.addChild(targetHolonContainer);

		// Container for ring
		var container = new PIXI.DisplayObjectContainer();
		VIEWER.container = container;
		container.position.x = VIEWER.geom.x;
		container.position.y = VIEWER.geom.y;
		container.alpha = 0;
		stage.addChild(container);

		// Background shade
		circleShade = new PIXI.Graphics();
        circleShade.lineStyle(0, 0);
        circleShade.beginFill(0x000000, 0.3);
        circleShade.drawCircle(VIEWER.geom.x, VIEWER.geom.y, VIEWER.geom.diam/2);
        circleShade.alpha = 0;
        stage.addChild(circleShade);
        TweenMax.to(circleShade, 1, {alpha:1});

		circleShade.interactive = true;
		circleShade.mousedown = circleShade.touchstart = function(data)
		{
			this.data = data;
		}
		circleShade.mouseup = circleShade.mouseupoutside = circleShade.touchend = circleShade.touchendoutside = function(data)
		{
			this.data = null;
			deselectHolons();
			resetFrameRate();
		}

        // Holon title (in viewer)
        holonTitle = new PIXI.Text("", {font: "25px archivo_regular", fill: "#ffffff", align: "center", dropShadow: true});
		holonTitle.position.x = VIEWER.geom.x;
		holonTitle.position.y = VIEWER.geom.y - VIEWER.geom.diam/2 - VIEWER.geom.ringSize;
		holonTitle.anchor.x = 0.5;
		stage.addChild(holonTitle);

			// Require sub-modules
			require(["js/holomap.viewer.ring.js"], function(m0, m1, m2)
			{
				RING = m0;
				RING.init(VIEWER, BROWSER.getHubColour());
			});				


		// Start animation
		resetFrameRate();
		requestAnimationFrame(animate);

		stage.setChildIndex(circleShade, 0);

		updateHolonicAddressPosition();
	}

	var updateHolonicAddressPosition = function()
	{	
		document.getElementById('addressIndicator').style.left = VIEWER.geom.x - $("#addressIndicator").width()/2 - 5;
	}
	VIEWER.updateHolonicAddressPosition = updateHolonicAddressPosition;

	var clearHolonTextAnnotations = function()
	{
		if (targetHolon)
		{
			for (var i = targetHolon.children.length - 1; i >= 0; i--)
			{
				if (targetHolon.children[i].isHolon)
				{
					var an = targetHolon.children[i].annotation;
					if (an)
					{
						TweenMax.killTweensOf(targetHolon.children[i].annotation);
						delete targetHolon.children[i].annotation;
						stage.removeChild(an);
					}
				}
			};
		}

		// Slightly silly hack
		var toRemove = [];
		for (var i = 0; i < stage.children.length; i++) {
			if (stage.children[i].isAnnotation)
			{
				toRemove.push(stage.children[i]);
			}
		};
		for (var i = 0; i < toRemove.length; i++) {
			stage.removeChild(toRemove[i])
		};
	}

	VIEWER.reset = function()
	{
		if (RING)
			RING.hideResizeAndDeleteButtons();
        if (INFOPANEL)
        	INFOPANEL.updateContent( null );

        targetHolonContainer.removeChildren();

        if (targetHolon)
        	stage.removeChild(targetHolon);

		setHolonTitle("")
        clearHolonTextAnnotations();
		parentHolon = targetHolon = zoomingHolon = selectedHolon = null;
	}

	var positionHolonAnnotation = function(h, parent)
	{
		if (h.annotation)
		{
			if (parent)
			{
				h.annotation.position.x = h.position.x;
				h.annotation.position.y = h.position.y;
			}
			else
			{
				h.annotation.position.x = targetHolonContainer.position.x + h.position.x*h.parent.scale.x;
				h.annotation.position.y = targetHolonContainer.position.y + h.position.y*h.parent.scale.y;
			}
		}
	}

	VIEWER.updateHolonAnnotation = function(id)
	{
		if (BROWSER.cache.h[id] && BROWSER.cache.h[id].__hi)
		{
			for (var i = BROWSER.cache.h[id].__hi.length - 1; i >= 0; i--)
			{
				var hi = BROWSER.cache.h[id].__hi[i];

				if (hi.isHolon)
				{
					var an = hi.annotation;
					if (an)
					{
						delete hi.annotation;
						stage.removeChild(an);
					}

					if (targetHolon.children.indexOf(hi) != -1)
						setHolonAnnotation(hi);
				}
			}
		}
	}

	var setHolonAnnotation = function(h, fade, parent)
	{
		if (h && h.parent && h.parent._id && BROWSER.cache.h[h.parent._id] && BROWSER.cache.h[h.parent._id]._t == "ss")
			return;

		if (h && h._id && BROWSER.cache.h[h._id] && BROWSER.cache.h[h._id]._t == "profile" && h.parent && h.parent._id && BROWSER.cache.h[h.parent._id] && BROWSER.cache.h[h.parent._id]._t == "ssi")
			return;

		if (h.isHolon)
		{
			var w = VIEWER.geom.diam * h.scale.x - 20;
			w = h.width;

			var t = '';

			if (BROWSER.cache.h[h._id].t)
				t = BROWSER.cache.h[h._id].t;

			var title;
			var maxHeight = h.height;
			var currentHeight = 9999999;

			for (var j = 0; j < 100; j++)
			{
				title = new PIXI.Text(t, {font: "18px archivo_regular", wordWrap:true, wordWrapWidth: w, fill: "#FFFFFF", align: "center", stroke: "#000000", strokeThickness: 1});
				currentHeight = title.height;

				if (currentHeight <= maxHeight && title.width <= h.width*1)
					break;

				t = t.replace(/\b(\s?\S+\s?)$/, "");
			};

			if (t == "" && BROWSER.cache.h[h._id].t)
				title = new PIXI.Text(BROWSER.cache.h[h._id].t.substr(0,4) + "...", {font: "18px archivo_regular", wordWrap:true, wordWrapWidth: w, fill: "#FFFFFF", align: "center", stroke: "#000000", strokeThickness: 1});

				title.anchor.x = title.anchor.y = 0.5;

				if (parent)
					parent.addChild(title);
				else
					stage.addChild(title);

				title.isAnnotation = true;

				if (fade)
				{
					title.alpha = 0;
					TweenMax.to(title, animSpeed, {alpha:1});
				}
				else
				{
					title.alpha = 1;
				}
				
				h.annotation = title;
				positionHolonAnnotation(h, parent);
		}
	}

	var setHolonAnnotations = function()
	{
		if (BROWSER.cache.h[targetHolon._id] && BROWSER.cache.h[targetHolon._id]._t == "ss")
			return;

		for (var i = targetHolon.children.length - 1; i >= 0; i--)
		{
			if (targetHolon.children[i].isHolon && !targetHolon.children[i].px)
			{
				if (BROWSER.cache.h[targetHolon.children[i]._id]._t == "profile")
					continue;

				var w = VIEWER.geom.diam * targetHolon.children[i].scale.x - 20;

				w = targetHolon.children[i].width;

				var t = "";

				if (BROWSER.cache.h[targetHolon.children[i]._id].t)
					t = BROWSER.cache.h[targetHolon.children[i]._id].t;

				var title;
				var maxHeight = targetHolon.children[i].height;
				var currentHeight = 9999999;

				for (var j = 0; j < 100; j++)
				{
					title = new PIXI.Text(t, {font: "18px archivo_regular", wordWrap:true, wordWrapWidth: w, fill: "#FFFFFF", align: "center", stroke: "#000000", strokeThickness: 1});
					currentHeight = title.height;

					if (currentHeight <= maxHeight && title.width <= targetHolon.children[i].width*1)
						break;

					t = t.replace(/\b(\s?\S+\s?)$/, "");
				};

				if (t == "" && BROWSER.cache.h[targetHolon.children[i]._id].t)
					title = new PIXI.Text(BROWSER.cache.h[targetHolon.children[i]._id].t.substr(0,4) + "...", {font: "18px archivo_regular", wordWrap:true, wordWrapWidth: w, fill: "#FFFFFF", align: "center", stroke: "#000000", strokeThickness: 1});

					title.anchor.x = title.anchor.y = 0.5;
					title.alpha = 0;
					title.isAnnotation = true;
					stage.addChild(title);
					TweenMax.to(title, animSpeed, {alpha:1});
					targetHolon.children[i].annotation = title;
					positionHolonAnnotation(targetHolon.children[i]);
			}
		};
	}

	var resetFrameRate = function()
	{
		frameRate = 1;

		if (frameRateTimer)
			clearTimeout(frameRateTimer);

		frameRateTimer = setTimeout(function()
		{
			frameRate = 100;
		}, 1000 * idleTimeInSeconds);
	}
	VIEWER.resetFrameRate = resetFrameRate;

	function animate() 
	{
		if (targetHolon)
		{
			if (targetHolon.activity)
				targetHolon.activity.rotation += 0.01;

			for (var i = targetHolon.children.length - 1; i >= 0; i--)
			{
				if (targetHolon.children[i].activity)
					targetHolon.children[i].activity.rotation += 0.01;


				if (targetHolon.children[i].res)
					targetHolon.children[i].res.rotation += 0.005;

			};
		}

		// time to render the state!
	    renderer.render(stage);
	    
	    // request another animation frame..
	    if (frameRate > 2)
	    {
	    	setTimeout(function(){
	    	requestAnimationFrame( animate );}, frameRate);
		}
		else
		{
			requestAnimationFrame( animate );
		}
	}

	setInterval(function()
	{
		if (selectedHolon && selectedHolon.highlight)
		{
			var highlight = selectedHolon.highlight;

			if (highlight.alpha == 1)
			{
				TweenMax.killTweensOf(highlight);
        		TweenMax.to(highlight, 0.1, {alpha:0.5});
			}
			else
			{
				TweenMax.killTweensOf(highlight);
        		TweenMax.to(highlight, 0.1, {alpha:1});
			}
		}
	}, 300);

	var selectHolon = function(h)
	{
		h.selected = true;

		if (!h.highlight)
		{
			highlight = new PIXI.Graphics();
	        highlight.lineStyle(8, 0xf9c752, 1.5);
	        highlight.beginFill(0xFFFFFF, 0.15);
	        highlight.drawCircle(0,0, h.width/2 / h._ls);
	        h.addChild(highlight);
	        highlight.alpha = 0;
	        h.highlight = highlight;

    	}

        TweenMax.to(h.highlight, 0.3, {alpha:1});

        selectedHolon = h;

		if (!EMBEDDED) 
			INFOPANEL.updateContent( BROWSER.cache.h[h._id] );

        if (canEditLink(BROWSER.cache.l[h._l]))
	        RING.showResizeAndDeleteButtons();
	}

	var canEditLink = function(link)
	{
		if (typeof link == "string")
			link = BROWSER.cache.l[link];

		if (link)
		{
			if (link.locked)
				return false;

			var pholon = BROWSER.cache.h[link._ti];
			if (BROWSER.username && (link._u == BROWSER.username || (pholon && (pholon._u == BROWSER.username || !pholon._pe || pholon._pe == [] || (pholon._pe && pholon._pe.indexOf(BROWSER.username) != -1))) ))
				return true;
			else
				return false;
		}
		else
		{
			return false;
		}
	}
	VIEWER.canEditLink = canEditLink;

	var createHolon = VIEWER.createHolon = function(x, y, holon)
    {
        // the x, y coordinates ideally would be in the 'link coordinate system', which is:
        // for x: -1 to 1 from left to right, where 0 is the middle)  <-- 1 is right
		// for y: -1 to 1 from top to bottom, where 0 is the middle)  <-- 1 is bottom
		
        var link_x = x / (VIEWER.geom.diam/2);
        var link_y = y / (VIEWER.geom.diam/2);
        var targetHolonId = VIEWER.getCurrentTargetHolonId();

        console.log(targetHolonId, VIEWER.canEdit(targetHolonId) )

        if (targetHolonId && VIEWER.canEdit(targetHolonId))
        {
        	var ontology = BROWSER.getOntology();

	       	// Normal case
	       	if ((ontology[holon.id] && !ontology[holon.id].d) || !ontology[holon.id] )
	       	{
	            var title = "";

	            var holonAttributes = {t: title};

	            if (BROWSER.cache.h[targetHolonId])
	            {
	            	if (BROWSER.cache.h[targetHolonId]._pe)
	                	holonAttributes._pe = [].concat(BROWSER.cache.h[targetHolonId]._pe);

	                if (BROWSER.cache.h[targetHolonId]._pa)
	                	holonAttributes._pa = [].concat(BROWSER.cache.h[targetHolonId]._pa);

	                if (holonAttributes._pe && holonAttributes._pe.indexOf(BROWSER.username) != -1)
	                	holonAttributes._pe.splice(holonAttributes._pe.indexOf(BROWSER.username), 1);

	                if (holonAttributes._pa && holonAttributes._pa.indexOf(BROWSER.username) != -1)
	                	holonAttributes._pa.splice(holonAttributes._pa.indexOf(BROWSER.username), 1);

	                if (BROWSER.cache.h[targetHolonId]._pa && BROWSER.cache.h[targetHolonId]._pa.length > 0)
	                	holonAttributes._pa.push( BROWSER.cache.h[targetHolonId]._u );

	                if (BROWSER.cache.h[targetHolonId]._pe && BROWSER.cache.h[targetHolonId]._pe.length > 0)
	                	holonAttributes._pe.push( BROWSER.cache.h[targetHolonId]._u );
	            }

	            CORELINK.createLinkedHolon({
	                _t: holon.id,
	                _ti: targetHolonId,
	                h: holonAttributes,
	                l: {x: link_x, y: link_y, s: 0.2}
	            })

	            console.log("created...",{
	                _t: holon.id,
	                _ti: targetHolonId,
	                h: holonAttributes,
	                l: {x: link_x, y: link_y, s: 0.2}
	            })
        	}
        	else
        	{
	            // Game holon (link something in, rather than create a new one)

        		var getRandomElement = function(arr)
        		{
        			return arr[Math.round(Math.random()*(arr.length-1))];
        		}

        		var lns = [];

        		if (BROWSER.cache.h[targetHolonId].__l)
        			lns = BROWSER.cache.h[targetHolonId].__l;
        		
        		var childHolonIds = [];

        		for (var i=0; i < lns.length; i++)
        			childHolonIds.push(B.cache.l[lns[i]]._fi);

        		var rId;

        		for (var i = 0; i < 100; i++)
        		{
        			rId = getRandomElement(ontology[holon.id].d);
        			if (childHolonIds.indexOf(rId) == -1)
        			{
        				break;
        			}
        		}

		        CORELINK.emit('create_link', {
		            _fi: rId,
		            _ti: targetHolonId,
		            l: {
		                x: link_x,
		                y: link_y,
		                s: 0.1
		            }
		        } );
        	}
        }
    }

	var canEdit = function(holon)
	{
		if (typeof holon == "string")
			holon = BROWSER.cache.h[holon];

		if (holon)
		{
			if (BROWSER.username && (!holon._pe || (holon._pe && holon._pe.length == 0) || holon._u == BROWSER.username || (holon._pe && holon._pe.indexOf(BROWSER.username) != -1)))
				return true;
			else
				return false;
		}
		else
		{
			return false;
		}
	}
	VIEWER.canEdit = canEdit;

	var deselectHolon = function(h)
	{
		if (h == selectedHolon)
			selectedHolon = null;

		h.selected = false;
		h.alpha = 1;	
		if (h.highlight)
			TweenMax.to(h.highlight, 0.3, {alpha:0});
	}

	var deselectHolons = function(exception)
	{
		selectedHolon = null;

		if (targetHolon && targetHolon.children)
		{
			for (var i = targetHolon.children.length - 1; i >= 0; i--)
			{
				if (targetHolon.children[i].isHolon)
				{
					if ((!exception || exception != targetHolon.children[i]) && targetHolon.children[i].selected)
					{
						targetHolon.children[i].selected = false;
						targetHolon.children[i].alpha = 1;	
						if (targetHolon.children[i].highlight)
							TweenMax.to(targetHolon.children[i].highlight, 0.3, {alpha:0});
					}
				}
			};

			RING.hideResizeAndDeleteButtons();

			if (!EMBEDDED)
				INFOPANEL.updateContent( BROWSER.cache.h[targetHolon._id] );
    	}
	}

	var setHolonTitle = VIEWER.setHolonTitle = function(t)
	{
		var dots = "";
        if (t && t.length > 60)
        	dots = "...";

        if (!t)
        	t = "";
		holonTitle.setText(t.substr(0,60)+dots);
	}

	var setHolonImageInteraction = function(h)
	{
		if (!h.isHolon) return;

		h.buttonMode = true
		h.interactive = true

		h.mousedown = h.touchstart = function(data)
		{
			// store a refference to the data
			// The reason for this is because of multitouch
			// we want to track the movement of this particular touch
			this.data = data;

			resetFrameRate();

			if (!canEditLink(BROWSER.cache.l[h._l]))
				return;

			if (h.parent && h.parent._id && BROWSER.cache.h[h.parent._id] && (BROWSER.cache.h[h.parent._id]._t == "ss" )  ) //|| BROWSER.cache.h[h.parent._id]._alm
				return;

			this.dragging = true;
			this.data.originX = this.position.x;
			this.data.originY = this.position.y;
			this.data.offsetX = this.data.getLocalPosition(this.parent).x - this.position.x;
			this.data.offsetY = this.data.getLocalPosition(this.parent).y - this.position.y;

			// Make sure holon is on highest layer, when dragging
			this.parent.setChildIndex(this, this.parent.children.length - 1);
			
			this.timeStart = new Date().getTime();
		};

		// set the events for when the mouse is released or a touch is released
		h.mouseup = h.mouseupoutside = h.touchend = h.touchendoutside = lalatest = function(data)
		{
			this.dragging = false;
			draggingHolon = null;

			var timeDelay = new Date().getTime() - this.timeStart;

			if (canEditLink(BROWSER.cache.l[h._l]) && this.data && timeDelay > 100 && (Math.abs(this.data.originX - this.position.x) > 1 || Math.abs(this.data.originY - this.position.y) > 1) )
			{
				if (this.dropTarget)
				{
					if (data.global.y <= 122)
					{
						NAVBAR.holonDroppedOnNavbar(data, BROWSER.cache.h[h._id]);

						// Move back to where it was
						this.position.x = data.originX;
						this.position.y = data.originY;
						this.width = this.height = (this.parent.width * this._ls) / this.parent.scale.x;
						if (this.annotation)
						{
							this.annotation.position.x = targetHolonContainer.position.x + this.position.x*this.parent.scale.x;
							this.annotation.position.y = targetHolonContainer.position.y + this.position.y*this.parent.scale.y;
						}
					}
					else
					{
						var newX = (this.position.x - this.dropTarget.position.x) / (this.dropTarget.width/2);
						var newY = (this.position.y - this.dropTarget.position.y) / (this.dropTarget.width/2);

						moveHolon(this, this.dropTarget, newX, newY);
					}
				}
				else
				{
					if (lineDistance(VIEWER.geom, data.global) > VIEWER.geom.diam/2)
					{
						if (parentHolon)
						{
							moveHolon(this, parentHolon, this._lx, this._ly);
						}
						else
						{
							this.position.x = data.originX;
							this.position.y = data.originY;
							if (this.annotation)
							{
								this.annotation.position.x = targetHolonContainer.position.x + this.position.x*this.parent.scale.x;
								this.annotation.position.y = targetHolonContainer.position.y + this.position.y*this.parent.scale.y;
							}
						}
					}
					else
					{
						var newX = this.position.x * this.parent.scale.x / (VIEWER.geom.diam/2);
						var newY = this.position.y * this.parent.scale.y / (VIEWER.geom.diam/2);

						h._lx = newX;
						h._ly = newY;

						BROWSER.cache.l[h._l].x = newX;
						BROWSER.cache.l[h._l].y = newY;

						for (var i = BROWSER.cache.l[h._l].__hi.length - 1; i >= 0; i--)
						{
							var hi = BROWSER.cache.l[h._l].__hi[i];

							hi.position.x = this.position.x;
							hi.position.y = this.position.y;
							
							hi._lx = newX;
							hi._ly = newY;

							if (Math.abs(hi._lx) > 1 || Math.abs(hi._ly) > 1)
							{
								hi.px = hi.position.x;
								hi.py = hi.position.y;
							}
							else
							{
								delete hi.px;
								delete hi.py;
							}
						};

						CORELINK.changeLinkPosition(h._l, newX, newY);
					}
				}

				draggingHolon = null;

				return;
			} 
			else if (!this.selected)
			{
				deselectHolons(this);
				selectHolon(this);
				return;
			}

			draggingHolon = null;

			viewGrandchildHolons(h);
			clearHolonTextAnnotations();

			this.selected = false;
			this.alpha = 1
			this.data = null;
			this.buttonMode = false
			this.interactive = false

			var tidyUp = function(h)
			{
				return function()
				{
					var p = h.parent;

					for (var i = h.children.length - 1; i >= 0; i--) {
						
						if (h.children[i].isHolon)
						{
							setHolonImageInteraction(h.children[i]);
						}
					};

					setHolonTitle(BROWSER.cache.h[h._id].t)

					// p is now a scaled up 'parent' holon (was target holon)
					// h is new target holon
					// make children interactive, when they are selected it zooms
					// call function that sets the functions on the sprites

					zoomingHolon = null;

					p.interactive = true;
					p.mousedown = p.touchstart = function(data)
					{
						this.data = data;
					}
					p.mouseup = p.mouseupoutside = p.touchend = p.touchendoutside = function(data)
					{
						var clickedOnChildHolon = false;
						for (var i = 0; i < targetHolon.children.length; i++)
						{
							if (targetHolon.children[i].__isDown)
							{
								clickedOnChildHolon = true;
								break;
							}
						};

						if (!EMBEDDED && !INFOPANEL.isEditing() && !clickedOnChildHolon && !draggingHolon && lineDistance(data.global, p.position) > VIEWER.geom.diam/2 + VIEWER.geom.ringSize*2)
							VIEWER.zoomOut();
					}

					CORELINK.emit('target_holon', h._id);

					updateRingHolonCreationArc(BROWSER.cache.h[h._id]._t, BROWSER.cache.h[h._id].ct);

					setLevel(level + 1);

					BROWSER.updateAddressIndicator(BROWSER.cache.h[h._id]);

					setHolonAnnotations();
				}
			}

			var p = this.parent;

			p.testing = 123;

			var sc = (VIEWER.geom.diam / h._ls) / p.texture.width;

			var newX = -this.position.x * sc;
			var newY = -this.position.y * sc;

			// Move holon
			p.removeChild(this) // remove new target holon from sprite (old target holon)
			targetHolonContainer.addChild(this); // add new target holon (this) to root container

			// change attributes so that it appears in the same place
			this.scale.x = this.scale.y = this.scale.x * p.scale.x;
			this.position.x *= p.scale.x;
			this.position.y *= p.scale.y;
			
			// tween to targetted position
			TweenMax.to(this, animSpeed, {width: VIEWER.geom.diam, height: VIEWER.geom.diam, ease:"Power4.easeInOut"});
			TweenMax.to(this.position, animSpeed, {x: 0, y: 0, ease:"Power4.easeInOut"});

			// Hide resonate ring
			if (this.res)
				TweenMax.to(this.res, animSpeed, {alpha: 0});

			targetHolon = this;
			onTargetHolonSet();

			// tween old target holon
			TweenMax.to(p, animSpeed, {alpha:0.5, ease:"Power4.easeInOut"});
			TweenMax.to(p.scale, animSpeed, {x:sc, y:sc, ease:"Power4.easeInOut"});

			TweenMax.to(p.position, animSpeed, {x: newX, y: newY, ease:"Power4.easeInOut", onComplete:tidyUp(this)});

			RING.hideResizeAndDeleteButtons();

			// tween old parent (parent parent)
			// fade it down and get rid of it on tidyup
			if (parentHolon)
			{
				TweenMax.to(parentHolon, animSpeed, {alpha:0, ease:"Power4.easeInOut"});
				holonTrail.push(parentHolon)
			}

			parentHolon = p;
			zoomingHolon = this;

			for (var i = h.children.length - 1; i >= 0; i--)
			{
				if (h.children[i].isHolon)
				{
					if (h.children[i].px)
					{
						var completeMovement = function(ch)
						{
							return function()
							{
								setHolonAnnotation(ch);
							}
						}

						TweenMax.to(h.children[i].position, animSpeed*2, {x:h.children[i].px, y:h.children[i].py, ease:"Power4.easeInOut", onComplete:completeMovement(h.children[i])});
						TweenMax.to(h.children[i], animSpeed*2, {alpha:1, ease:"Power4.easeInOut"});
					}
					else
					{
						TweenMax.to(h.children[i], animSpeed, {alpha:1, ease:"Power4.easeInOut"});

					}
				}
			};

			for (var i = p.children.length - 1; i >= 0; i--)
			{
				if (p.children[i].isHolon )
				{
					p.children[i].interactive = false;
				}
			};

			deselectHolon(targetHolon);

			TweenMax.killTweensOf(parentHolon.r1);

			TweenMax.killTweensOf(parentHolon.r2);

			if (parentHolon.r1)
				parentHolon.r1.alpha = 0;

			if (parentHolon.r2)
				parentHolon.r2.alpha = 0;
		};

		h.mouseover = function(data)
		{
			this.isOver = true;

			if (!EMBEDDED && !selectedHolon && !INFOPANEL.isEditing())
				INFOPANEL.updateContent( BROWSER.cache.h[h._id] );
		}

		h.mouseout = function(data){
			
			this.isOver = false;
			if (!EMBEDDED && !selectedHolon && !INFOPANEL.isEditing() && targetHolon)
				INFOPANEL.updateContent( BROWSER.cache.h[targetHolon._id] )
		}
		
		h.touchmove = h.mousemove = function(data)
		{
			if(this.dragging)
			{
				draggingHolon = this;

				var newPosition = this.data.getLocalPosition(this.parent);

				this.position.x = newPosition.x - this.data.offsetX;
				this.position.y = newPosition.y - this.data.offsetY;

				if (this.annotation)
				{
					this.annotation.position.x = targetHolonContainer.position.x + this.position.x*this.parent.scale.x;
					this.annotation.position.y = targetHolonContainer.position.y + this.position.y*this.parent.scale.y;
				}

				resetFrameRate();

				var ot;
				if (this.dropTarget)
					ot = this.dropTarget

				this.dropTarget = null;

				// Over another holon?
				for (var i = this.parent.children.length - 1; i >= 0; i--)
				{
					if (this.parent.children[i].isHolon && this != this.parent.children[i])
					{
						if (lineDistance(this.parent.children[i].position, this.data.getLocalPosition(this.parent)) < this.parent.children[i].height/2)
						{
							this.dropTarget = this.parent.children[i];
						}
					}
				};

				if (this.dropTarget && ot != this.dropTarget && this._id != this.dropTarget._id)
				{
					TweenMax.to(this, animSpeed, {width:40, ease:"Power4.easeInOut"});
					TweenMax.to(this, animSpeed, {height:40, ease:"Power4.easeInOut"});
					TweenMax.to(this.data, animSpeed, {offsetX:0, ease:"Power4.easeInOut"});
					TweenMax.to(this.data, animSpeed, {offsetY:0, ease:"Power4.easeInOut"});
				}
				else if (!this.dropTarget && ot)
				{
					var ow = (this.parent.width * this._ls) / this.parent.scale.x;
					TweenMax.to(this, animSpeed, {width:ow, ease:"Power4.easeInOut"});
					TweenMax.to(this, animSpeed, {height:ow, ease:"Power4.easeInOut"});
				}
			}
		}
	}

	function lineDistance( point1, point2 )
	{
	  var xs = 0;
	  var ys = 0;
	 
	  xs = point2.x - point1.x;
	  xs = xs * xs;
	 
	  ys = point2.y - point1.y;
	  ys = ys * ys;
	 
	  return Math.sqrt( xs + ys );
	}

	var rgbStringToInt = function(s)
	{
		var cs = s.split(',');
		try
		{
			var c = (parseInt(cs[0]) << 16) + (parseInt(cs[1]) << 8) + (parseInt(cs[2]));
			return c;
		}
		catch(e)
		{
			return 0xFFFFFF;
		}
	}
	VIEWER.rgbStringToInt = rgbStringToInt;

	VIEWER.cacheHolonTypeColour = function(id, rgbString)
	{
		typeColours[id] = rgbStringToInt(rgbString);
	}

	VIEWER.getTypeColour = function(typeId)
	{
		if (typeColours[typeId])
			return typeColours[typeId];
	}

	updateRingHolonCreationArc = function(_t, ct)
	{
		var ontology = BROWSER.getOntology();

		var typeSpec = [];

		if (ontology && ontology[_t] && ontology[_t].ct)
		{
			typeSpec = [];

			for (var i = 0; i < ontology[_t].ct.length; i++)
			{
				var tid = ontology[_t].ct[i];

				if (ontology[tid])
					typeSpec.push( {t: ontology[tid].t, id: tid, c: rgbStringToInt(ontology[tid].rgb)} );
			};

			if (_t == "hub" && ct)
			{
				if (typeof ct == "string")
					ct = ct.split(',');

				for (var i = 0; i < ct.length; i++)
				{
					var tid = ct[i];

					if (ontology[tid])
						typeSpec.push( {t: ontology[tid].t, id: tid, c: rgbStringToInt(ontology[tid].rgb)} );
				};
			}
		}	
		
		RING.updateHolonCreationArc( typeSpec );
	}

	VIEWER.zoomRightOut = function()
	{
		zoomOut(true);
	}

	var zoomOut = function(zoomOutAgain)
	{
		if (!parentHolon || zooming)
			return;

		zooming = true;

		resetFrameRate();

		deselectHolons();

		clearHolonTextAnnotations();

		var completeZoomOut = function()
		{
			zooming = false;

			// Move holon back into its parent
			targetHolonContainer.removeChild(targetHolon); // remove new target holon from sprite (old target holon)
			parentHolon.addChildAt(targetHolon, 0); // add new target holon (this) to root container

			if (parentHolon.ss)
				parentHolon.addChildAt(parentHolon.ss, 0);
				
			// change attributes so that it appears in the same place
			targetHolon.width = targetHolon.height = (targetHolon.parent.width * targetHolon._ls) / targetHolon.parent.scale.x;
			targetHolon.position.x = (VIEWER.geom.diam / targetHolon.parent.scale.x / 2) * targetHolon._lx;
			targetHolon.position.y = (VIEWER.geom.diam / targetHolon.parent.scale.y / 2) * targetHolon._ly;

			setHolonImageInteraction(targetHolon);

			targetHolon = parentHolon;
			onTargetHolonSet();

			if (holonTrail.length > 0)
				parentHolon = holonTrail.pop();
			else
				parentHolon = null;

			for (var i = targetHolon.children.length - 1; i >= 0; i--)
			{
				if (targetHolon.children[i].isHolon )
				{
					targetHolon.children[i].interactive = true;
					targetHolon.children[i].alpha = 1;
				}
			};

			if (targetHolon.r1)
				TweenMax.to(targetHolon.r1, animSpeed*4, {alpha:1});
			if (targetHolon.r2)
				TweenMax.to(targetHolon.r2, animSpeed*4, {alpha:1});

			setHolonTitle(BROWSER.cache.h[targetHolon._id].t);

			CORELINK.emit('target_holon', targetHolon._id);

			updateRingHolonCreationArc(BROWSER.cache.h[targetHolon._id]._t, BROWSER.cache.h[targetHolon._id].ct);

			setLevel(level - 1);

			BROWSER.updateAddressIndicator(BROWSER.cache.h[targetHolon._id]);

			setHolonAnnotations();

			if (zoomOutAgain)
				zoomOut( parentHolon != null );
		}

		// Tween target holon (will become child holon)
		var newX = (VIEWER.geom.diam / targetHolon.parent.scale.x / 2) * targetHolon._lx;
		var newY = (VIEWER.geom.diam / targetHolon.parent.scale.y / 2) * targetHolon._ly;
			
		// tween to targetted position
		TweenMax.to(targetHolon, animSpeed, {width: targetHolon._ls*VIEWER.geom.diam, height: targetHolon._ls*VIEWER.geom.diam, ease:"Power4.easeInOut"});
		TweenMax.to(targetHolon.position, animSpeed, {x: newX, y: newY, ease:"Power4.easeInOut"});

		// Show resonate ring
		if (targetHolon.res)
			TweenMax.to(targetHolon.res, animSpeed*2, {alpha: 1, ease:"Power4.easeInOut"});

		// Tween parent holon (will become target holon)
		TweenMax.to(parentHolon.position, animSpeed, {x: 0, y: 0, ease:"Power4.easeInOut"});
		TweenMax.to(parentHolon, animSpeed, {width: VIEWER.geom.diam, height: VIEWER.geom.diam, ease:"Power4.easeInOut"});
		TweenMax.to(parentHolon, animSpeed, {alpha:1, ease:"Power4.easeInOut", onComplete:completeZoomOut});

		// Inner holon type ring
		if (parentHolon.r1)
			parentHolon.r1.alpha = 0;
		if (parentHolon.r2)
			parentHolon.r2.alpha = 0;

		TweenMax.to(targetHolon.r1, animSpeed, {alpha:0.5});
		TweenMax.to(targetHolon.r2, animSpeed, {alpha:0.5});

		// Bring back the old parent
		if (holonTrail.length > 0)
			TweenMax.to(holonTrail[holonTrail.length-1], animSpeed, {alpha:0.3, ease:"Power4.easeInOut"});

		// Disable child holon interactivity
		for (var i = targetHolon.children.length - 1; i >= 0; i--)
		{
			targetHolon.children[i].buttonMode = false
			targetHolon.children[i].interactive = false

			if (targetHolon.children[i].isHolon)
			{
				if (!(Math.abs(targetHolon.children[i]._lx) > 1 || Math.abs(targetHolon.children[i]._ly) > 1))
					TweenMax.to(targetHolon.children[i], animSpeed, {alpha:0.5, ease:"Power4.easeInOut"});
				else
					TweenMax.to(targetHolon.children[i], animSpeed, {alpha:0, ease:"Power4.easeInOut"});

				if (targetHolon.children[i].px)
					TweenMax.to(targetHolon.children[i].position, animSpeed, {x:0, y:0, ease:"Power4.easeInOut"});
			}
		};
	}
	VIEWER.zoomOut = zoomOut;

	var updateActivityGraphics = function(o, g, t)
	{
		g.clear();
        g.lineStyle(0, 0);
        g.beginFill(0xff00ff, 1);

     	var x, y;
     	var r = (o.width) /2 / o.scale.x - 16;

        for (var i = 0; i < t; i++)
        {
        	x = Math.cos(2*Math.PI*(i/t)) * r;
            y = Math.sin(2*Math.PI*(i/t)) * r; 

        	g.drawCircle(x, y, 4);
        }
	}	

	VIEWER.setHolonActivity = function(id, t)
	{
		if (targetHolon && id == targetHolon._id)
			t--;

		if (BROWSER.cache.h[id].__hi)
		{
			for (var i = BROWSER.cache.h[id].__hi.length - 1; i >= 0; i--)
			{
				var hi = BROWSER.cache.h[id].__hi[i];
				var g = hi.activity;

				if (!g)
				{
					g = new PIXI.Graphics();
					hi.addChild(g);	
					hi.activity = g;
				}

				updateActivityGraphics(hi, g, t); 
			}
		}
	} 

	VIEWER.hide_target_holon = function()
	{
		resetFrameRate();

		// Fade out container
		TweenMax.to(targetHolonContainer, animSpeed, {alpha:0});

		// Fade in shade
		TweenMax.to(circleShade, animSpeed, {alpha:1});
	}

	VIEWER.show_loading_animation = function()
	{
	}

	VIEWER.getCurrentTargetHolonId = function()
	{
		if (targetHolon)
			return targetHolon._id;
		else
			return null;
	}

	VIEWER.view_holon = function(id)
	{
		resetFrameRate();

		var bgimage = "/img/default.png"; // TEMP

		if (BROWSER.cache.h[id])
		{
			if (BROWSER.cache.h[id]._b)
			{
				bgimage = "/img/user/" + BROWSER.cache.h[id]._b;
			}
			else
			{
				var ontology = BROWSER.getOntology();

				if (ontology[BROWSER.cache.h[id]._t] && ontology[BROWSER.cache.h[id]._t].bg)
					bgimage = "/img/user/" + ontology[BROWSER.cache.h[id]._t].bg;
			}
		}

		// Create object (if necessary)
		if (!BROWSER.cache.h[id].__o)
		{
			try
			{
				var targetHolonImage = PIXI.Sprite.fromFrame(bgimage);
				targetHolonImage._id = id;

				setupTargetHolonImage(targetHolonImage);
				setTargetHolon(targetHolonImage);
			}
			catch(e)
			{
				// create a new loader
				var loader = new PIXI.AssetLoader([ bgimage ]);
				
				var onCompleteF = function(bgimage, id, targetHolonImage)
				{
					return function()
					{
						var targetHolonImage = PIXI.Sprite.fromFrame(bgimage);
						targetHolonImage._id = id;

						setupTargetHolonImage(targetHolonImage);
						setTargetHolon(targetHolonImage);
					}
				}

				// use callback
				loader.onComplete = onCompleteF(bgimage, id, targetHolonImage);

				//begin load
				loader.load();
			}
		}
		else
		{
			setTargetHolon(BROWSER.cache.h[id].__o);
		}
	}

	var setupTargetHolonImage = function(targetHolonImage)
	{
		// Setup object
		targetHolonImage.isHolon = true;
		targetHolonImage.anchor.x = targetHolonImage.anchor.y = 0.5;
		targetHolonImage.width = VIEWER.geom.diam;
		targetHolonImage.height = VIEWER.geom.diam;

		// Link to holon
		BROWSER.cache.h[targetHolonImage._id].__o = targetHolonImage; // todo: change to array

		if (!BROWSER.cache.h[targetHolonImage._id].__hi)
			BROWSER.cache.h[targetHolonImage._id].__hi = [];
		BROWSER.cache.h[targetHolonImage._id].__hi.push(targetHolonImage);

		var holon = BROWSER.cache.h[targetHolonImage._id];

		if (typeColours && holon && !holon._b && holon._t && typeColours[holon._t])
			targetHolonImage.tint = typeColours[holon._t];

		if (typeColours[holon._t])
		{
			var offset = Math.PI / 8;
			var nd = (targetHolonImage.width/2) / targetHolonImage.scale.x;

			var holonTypeColourRing = new PIXI.Graphics();
			targetHolonImage.addChild(holonTypeColourRing);
			holonTypeColourRing.lineStyle(4, 0xFFFFFF);
			holonTypeColourRing.arc(0,0 ,nd, 0, 2*Math.PI, false );
			holonTypeColourRing.alpha = 0.5;
			holonTypeColourRing.tint = typeColours[holon._t];
			targetHolonImage.r1 = holonTypeColourRing;

			var holonTypeColourRing2 = new PIXI.Graphics();
			targetHolonImage.addChild(holonTypeColourRing2);
			holonTypeColourRing2.lineStyle(4, 0xFFFFFF);
			holonTypeColourRing2.arc(0,0 , nd, offset, 2*Math.PI + offset, false );
			holonTypeColourRing2.alpha = 0.5;
			holonTypeColourRing2.tint = typeColours[holon._t];
			targetHolonImage.r2 = holonTypeColourRing2;
		}
	}

	var onTargetHolonSet = function()
	{
		BROWSER.targetHolon = BROWSER.cache.h[targetHolon._id];		
		
		if (!EMBEDDED)
			INFOPANEL.updateContent( BROWSER.cache.h[targetHolon._id] );
	}

	var setLevel = function(l)
	{
		level = l;
	}

	var setTargetHolon = function(targetHolonImage)
	{
		setLevel(1);

		resetFrameRate();

		targetHolonContainer.addChild(targetHolonImage);
		targetHolon = targetHolonImage; 
		onTargetHolonSet();

		// Fade in container
		TweenMax.to(targetHolonContainer, 1, {alpha:1, ease:'easeOut'});

		// Fade down shade
		TweenMax.to(circleShade, animSpeed, {alpha:0});

		// For child holons: show child holons (if any)
		if (BROWSER.cache.h[targetHolonImage._id].__l)
		{
			for (var i = BROWSER.cache.h[targetHolonImage._id].__l.length - 1; i >= 0; i--)
			{
				var lid = BROWSER.cache.h[targetHolonImage._id].__l[i];
				processChild(targetHolonImage, lid);
			};
		}

		setHolonTitle(BROWSER.cache.h[targetHolon._id].t)

		CORELINK.emit('target_holon', targetHolon._id);

		if (RING)
			updateRingHolonCreationArc(BROWSER.cache.h[targetHolon._id]._t, BROWSER.cache.h[targetHolon._id].ct );
	}

	var hasChildHolon = function(holonImage, chid)
	{
		if (holonImage == parentHolon && targetHolon._id == chid)
			return true;

		for (var i = holonImage.children.length - 1; i >= 0; i--)
			if (holonImage.children[i]._id && holonImage.children[i]._id == chid)
				return true;

		return false;
	}

	var viewGrandchildHolons = function(holonImage)
	{
		// IF WE HAVE THE HOLONS AND LINKS....
		// Add new holon images to each childHolonImage (parentHolonImage) in holonImage

		var makeRequest = false;

		for (var i = holonImage.children.length - 1; i >= 0; i--)
		{
			if (holonImage.children[i].isHolon)
			{
				if (BROWSER.haveReceivedChildHolons(holonImage.children[i]._id))
				{
					var h = BROWSER.cache.h[holonImage.children[i]._id];

			        for (var j = h.__l.length - 1; j >= 0; j--)
			        {
						if (BROWSER.cache.l[h.__l[j]] && !hasChildHolon(holonImage.children[i], BROWSER.cache.l[h.__l[j]]._fi ))
						{
							processChild(holonImage.children[i], h.__l[j]);
						}
					}
				}
				else
				{
					makeRequest = true;
				}
			}
		};

		if (makeRequest)
			BROWSER.getGrandchildHolons( BROWSER.cache.h[holonImage._id] );
	}

	VIEWER.processLinkUpdate = function(lid, pp)
	{
		if (BROWSER.cache.h[BROWSER.cache.l[lid]._ti] && BROWSER.cache.h[BROWSER.cache.l[lid]._ti].__hi && !pp)
			for (var i = BROWSER.cache.h[BROWSER.cache.l[lid]._ti].__hi.length - 1; i >= 0; i--)
				processChild(BROWSER.cache.h[BROWSER.cache.l[lid]._ti].__hi[i], lid);
	}	

	VIEWER.processHolonUpdate = function(h)
	{
		if (h._b)
			VIEWER.updateHolonBackground(h);

		if (h.t)
			VIEWER.updateHolonAnnotation(h._id);

		if (h._n && targetHolon && targetHolon._id == h._id)
			BROWSER.updateAddressIndicator(h);

		if (h._t)
		{
			var holon = BROWSER.cache.h[h._id];

			if (typeColours && holon && !holon._b && holon._t && typeColours[holon._t])
			{
				for (var i = 0; i < holon.__hi.length; i++)
				{
					holon.__hi[i].tint = holon.__hi[i].r1.tint = holon.__hi[i].r2.tint = typeColours[holon._t];
				};
			}
		}

		if ((h._pa || h._pe) && INFOPANEL.getCurrentHolonId() == h._id && INFOPANEL.getMode() == "settings")
			INFOPANEL.displaySettings(BROWSER.cache.h[INFOPANEL.getCurrentHolonId()]);
	}

	var processChild = function(parentHolonImage, lid)
	{
		var chid = BROWSER.cache.l[lid]._fi;
		var ch = BROWSER.cache.h[chid];

		if (!ch)
			return;

		var createNewOne = true;

		if (BROWSER.cache.l[lid].__hi)
		{
			for (var i = BROWSER.cache.l[lid].__hi.length - 1; i >= 0; i--)
			{
				var hi = BROWSER.cache.l[lid].__hi[i];
				var link = BROWSER.cache.l[lid];

				hi._lx = link.x;
				hi._ly = link.y;
				hi._ls = link.s;
				hi._l = link._id;

				if (hi != targetHolon)
				{
					hi.width = hi.height = (hi.parent.width * link.s) / hi.parent.scale.x;
					hi.position.x = ((hi.parent.width / 2) * hi._lx) / hi.parent.scale.x;
					hi.position.y = ((hi.parent.width / 2) * hi._ly) / hi.parent.scale.y;
				}
				
				createNewOne = false;

				positionHolonAnnotation(hi);

				var an = hi.annotation;
				if (an)
				{
					delete hi.annotation;
					stage.removeChild(an);
					setHolonAnnotation(hi);
				}
			};
		}

		// Not perfect, but it works...
		if (targetHolon._l == lid)
		{
			var tposX = ((targetHolon.parent.width / 2) * targetHolon._lx) / targetHolon.parent.scale.x;
			var tposY = ((targetHolon.parent.width / 2) * targetHolon._ly) / targetHolon.parent.scale.y;
			var newX = -tposX ;
			var newY = -tposY ;
			TweenMax.to(parentHolon.position, animSpeed, {x: newX, y: newY, ease:"Power4.easeInOut"});	
		}

		if (!hasChildHolon(parentHolonImage, BROWSER.cache.l[lid]._fi ))
			createNewOne = true;

		// Child holon image stored in link?
		// Create object (if necessary)
		if (createNewOne) // todo: change to array
		{
			var bgimage = "/img/default.png";

			if (ch._b)
			{
				bgimage = "/img/user/" + ch._b;
			}
			else
			{
				var ontology = BROWSER.getOntology();

				if (ontology[BROWSER.cache.h[ch._id]._t] && ontology[BROWSER.cache.h[ch._id]._t].bg)
					bgimage = "/img/user/" + ontology[BROWSER.cache.h[ch._id]._t].bg;
			}

			try
			{
				var childHolonImage = PIXI.Sprite.fromFrame(bgimage);

				if (childHolonImage.texture.height != 444)
					throw("incorrect image size")

				//console.log("created image", BROWSER.cache.h[chid].t);
				childHolonImage._id = chid;
				childHolonImage._l = lid;
				BROWSER.cache.l[lid].__o = childHolonImage; // todo: change to array
				BROWSER.cache.h[chid].__o = childHolonImage; // WARNING // THIS NEEDS TO BE AN ARRAY SOON

				if (!BROWSER.cache.l[lid].__hi)
					BROWSER.cache.l[lid].__hi = [];
				BROWSER.cache.l[lid].__hi.push(childHolonImage);

				if (!BROWSER.cache.h[chid].__hi)
					BROWSER.cache.h[chid].__hi = [];
				BROWSER.cache.h[chid].__hi.push(childHolonImage);

				setupChildHolonImage(parentHolonImage, childHolonImage, BROWSER.cache.l[lid], ch, 1);
				positionHolonAnnotation(childHolonImage);
			}
			catch(e)
			{
				// create a new loader
				var loader = new PIXI.AssetLoader([ bgimage ]);

				var onCompleteF = function(chid, bgimage, lid, ch, parentHolonImage)
				{
					return function()
					{
						var childHolonImage = PIXI.Sprite.fromFrame(bgimage);
						childHolonImage._id = chid;
						childHolonImage._l = lid;
						BROWSER.cache.l[lid].__o = childHolonImage;

						if (!BROWSER.cache.l[lid].__hi)
							BROWSER.cache.l[lid].__hi = [];
						BROWSER.cache.l[lid].__hi.push(childHolonImage);

						if (!BROWSER.cache.h[chid].__hi)
							BROWSER.cache.h[chid].__hi = [];
						BROWSER.cache.h[chid].__hi.push(childHolonImage);

						setupChildHolonImage(parentHolonImage, childHolonImage, BROWSER.cache.l[lid], ch, 1);
						positionHolonAnnotation(childHolonImage);
					}
				}

				// use callback
				loader.onComplete = onCompleteF(chid, bgimage, lid, ch, parentHolonImage);

				//begin load
				loader.load();
			}
		}
	}

	var setupChildHolonImage = function(parentHolonImage, childHolonImage, link, holon, rDepth)
	{
		if (!rDepth)
			rDepth = 0;

		resetFrameRate();

		if (parentHolonImage)
			parentHolonImage.addChildAt(childHolonImage, 0);
		else
			parentHolonsContainer.addChild(childHolonImage);

		if (parentHolonImage.ss)
			parentHolonImage.addChildAt(parentHolonImage.ss,0);

		childHolonImage.isHolon = true;
		childHolonImage.anchor.x = childHolonImage.anchor.y = 0.5;
		childHolonImage.width = childHolonImage.height = (childHolonImage.parent.width * link.s) / childHolonImage.parent.scale.x;
		childHolonImage._lx = link.x;
		childHolonImage._ly = link.y;
		childHolonImage._ls = link.s;
		childHolonImage.position.x = ((childHolonImage.parent.width / 2) * childHolonImage._lx) / childHolonImage.parent.scale.x;
		childHolonImage.position.y = ((childHolonImage.parent.width / 2) * childHolonImage._ly) / childHolonImage.parent.scale.y;
		childHolonImage.alpha = 0;

        var offset = Math.PI / 8;
		var nd = (childHolonImage.width/2) / childHolonImage.scale.x;

		var holonTypeColourRing = new PIXI.Graphics();
		childHolonImage.addChild(holonTypeColourRing);
		holonTypeColourRing.lineStyle(4, 0xFFFFFF);
		holonTypeColourRing.arc(0,0 ,nd, 0, 2*Math.PI, false );
		holonTypeColourRing.alpha = 0.5;
		holonTypeColourRing.tint = typeColours[holon._t];
		childHolonImage.r1 = holonTypeColourRing;

		var holonTypeColourRing2 = new PIXI.Graphics();
		childHolonImage.addChild(holonTypeColourRing2);
		holonTypeColourRing2.lineStyle(4, 0xFFFFFF);
		holonTypeColourRing2.arc(0,0 , nd, offset, 2*Math.PI + offset, false );
		holonTypeColourRing2.alpha = 0.5;
		holonTypeColourRing2.tint = typeColours[holon._t];
		childHolonImage.r2 = holonTypeColourRing2;

		var h = BROWSER.cache.h[childHolonImage._id];
		if (h.r)
		{
			var resonatorRing = new PIXI.Graphics();
			childHolonImage.addChild(resonatorRing);
			updateResonateGraphics(resonatorRing, nd*0.04, nd*1.1, h.r);
			console.log(h.t, resonatorRing, nd*0.03, nd, h.r)
			childHolonImage.res = resonatorRing;
		}

		if (typeColours && holon && !holon._b && holon._t && typeColours[holon._t])
			childHolonImage.tint = typeColours[holon._t];

		if (parentHolonImage == targetHolon)
		{
			setHolonImageInteraction(childHolonImage);
			TweenMax.to(childHolonImage, animSpeed, {alpha:1});
			setHolonAnnotation(childHolonImage, true);
		}
		else
		{
			setHolonImageInteraction(childHolonImage);

			childHolonImage.interactive = false;

			if (!(Math.abs(link.x) > 1 || Math.abs(link.y) > 1))
			{
				TweenMax.to(childHolonImage, animSpeed, {alpha:0.5});
			}
			else
			{
				childHolonImage.px = childHolonImage.position.x;
				childHolonImage.py = childHolonImage.position.y;

				childHolonImage.position.x = 0;
				childHolonImage.position.y = 0;
			}
		}

		// Link to holon
		BROWSER.cache.h[childHolonImage._id].__o = childHolonImage; // todo: change to array

		// FOR CHILD HOLONS
		// Show child holons (if any)
		if (BROWSER.cache.h[childHolonImage._id].__l)
		{
			for (var i = BROWSER.cache.h[childHolonImage._id].__l.length - 1; i >= 0; i--)
			{
				var lid = BROWSER.cache.h[childHolonImage._id].__l[i];

				if (!BROWSER.cache.l[lid])
					continue;

				var chid = BROWSER.cache.l[lid]._fi;
				var ch = BROWSER.cache.h[chid];

				var bgimage = "/img/default.png";

				if (!ch)
					break;

				if (ch._b)
				{
					bgimage = "/img/user/" + ch._b;
				}
				else
				{
					var ontology = BROWSER.getOntology();

					if (ontology[BROWSER.cache.h[ch._id]._t] && ontology[BROWSER.cache.h[ch._id]._t].bg)
						bgimage = "/img/user/" + ontology[BROWSER.cache.h[ch._id]._t].bg;
				}

				// Child holon image stored in link?
				// Create object (if necessary)
				if (!BROWSER.cache.l[lid].__o && rDepth < 2)
				{
					try
					{
						var childChildHolonImage = PIXI.Sprite.fromFrame(bgimage);

						if (childChildHolonImage.texture.height != 444)
							throw("incorrect image size")

						childChildHolonImage._id = chid;
						childChildHolonImage._l = lid;
						BROWSER.cache.l[lid].__o = childChildHolonImage;

						if (!BROWSER.cache.l[lid].__hi)
							BROWSER.cache.l[lid].__hi = [];
						BROWSER.cache.l[lid].__hi.push(childChildHolonImage);

						if (!BROWSER.cache.h[chid].__hi)
							BROWSER.cache.h[chid].__hi = [];
						BROWSER.cache.h[chid].__hi.push(childChildHolonImage);

						setupChildHolonImage(childHolonImage, childChildHolonImage, BROWSER.cache.l[lid], ch, rDepth+1);
					}
					catch(e)
					{
						// create a new loader
						var loader = new PIXI.AssetLoader([ bgimage ]);

						var onCompleteF = function(chid, bgimage, lid, ch, childHolonImage)
						{
							return function()
							{
								var childChildHolonImage = PIXI.Sprite.fromFrame(bgimage);
								childChildHolonImage._id = chid;
								childChildHolonImage._l = lid;
								BROWSER.cache.l[lid].__o = childChildHolonImage;

								if (!BROWSER.cache.l[lid].__hi)
									BROWSER.cache.l[lid].__hi = [];
								BROWSER.cache.l[lid].__hi.push(childChildHolonImage);

								if (!BROWSER.cache.h[chid].__hi)
									BROWSER.cache.h[chid].__hi = [];
								BROWSER.cache.h[chid].__hi.push(childChildHolonImage);

								setupChildHolonImage(childHolonImage, childChildHolonImage, BROWSER.cache.l[lid], ch, rDepth+1);
							}
						}

						// use callback
						loader.onComplete = onCompleteF(chid, bgimage, lid, ch, childHolonImage);

						//begin load
						loader.load();
					}
				}
				else if (rDepth < 2)
				{
					try
					{
						var childChildHolonImage = PIXI.Sprite.fromFrame(bgimage);

						if (childChildHolonImage.texture.height != 444)
							throw("incorrect image size")

						childChildHolonImage._id = chid;
						childChildHolonImage._l = lid;

						if (!BROWSER.cache.l[lid].__hi)
							BROWSER.cache.l[lid].__hi = [];
						BROWSER.cache.l[lid].__hi.push(childChildHolonImage);

						if (!BROWSER.cache.h[chid].__hi)
							BROWSER.cache.h[chid].__hi = [];
						BROWSER.cache.h[chid].__hi.push(childChildHolonImage);

						setupChildHolonImage(childHolonImage, childChildHolonImage, BROWSER.cache.l[lid], ch, rDepth+1);

					}
					catch(e)
					{
					}
				}
			};
		}

		if (holon._a)
			VIEWER.setHolonActivity(holon._id, holon._a);
	}

	VIEWER.updateHolonBackground = function(holonUpdate)
	{
		var id = holonUpdate._id;
		var filename = "/img/user/" + holonUpdate._b;

		// create a new loader
		var loader = new PIXI.AssetLoader([ filename ]);
		
		// use callback
		loader.onComplete = function()
		{
			for (var i = BROWSER.cache.h[id].__hi.length - 1; i >= 0; i--)
			{
				var hi = BROWSER.cache.h[id].__hi[i];
				hi.setTexture(  PIXI.Texture.fromFrame(filename) );
				hi.tint = 0xFFFFFF;
			}
		}

		//begin load
		loader.load();
	}

	var increaseSelectedHolonSize = function()
	{
		if (selectedHolon && canEditLink(BROWSER.cache.l[selectedHolon._l]) )
		{
			if (selectedHolon._ls <= 0.799)
			{
				selectedHolon._ls += 0.05;

				var new_ls = selectedHolon._ls;

				BROWSER.cache.l[selectedHolon._l].s = selectedHolon._ls;

				for (var i = BROWSER.cache.l[selectedHolon._l].__hi.length - 1; i >= 0; i--)
				{
					var hi = BROWSER.cache.l[selectedHolon._l].__hi[i];
					hi.width = hi.height = (hi.parent.width * selectedHolon._ls) / hi.parent.scale.x;
					hi._ls = new_ls;
				};

				CORELINK.changeLinkSize(selectedHolon._l, selectedHolon._ls);

				var an = selectedHolon.annotation;
				if (an)
				{
					delete selectedHolon.annotation;
					stage.removeChild(an);
					setHolonAnnotation(selectedHolon);
				}
			}
		}
	}
	VIEWER.increaseSelectedHolonSize = increaseSelectedHolonSize;

	var decreaseSelectedHolonSize = function()
	{
		if (selectedHolon && canEditLink(BROWSER.cache.l[selectedHolon._l]))
		{
			if (selectedHolon._ls >= 0.15)
			{
				selectedHolon._ls -= 0.05;

				var new_ls = selectedHolon._ls;

				BROWSER.cache.l[selectedHolon._l].s = selectedHolon._ls;

				for (var i = BROWSER.cache.l[selectedHolon._l].__hi.length - 1; i >= 0; i--)
				{
					var hi = BROWSER.cache.l[selectedHolon._l].__hi[i];
					hi.width = hi.height = (hi.parent.width * selectedHolon._ls) / hi.parent.scale.x;
					hi._ls = new_ls;
				};

				CORELINK.changeLinkSize(selectedHolon._l, selectedHolon._ls);

				var an = selectedHolon.annotation;
				if (an)
				{
					delete selectedHolon.annotation;
					stage.removeChild(an);
					setHolonAnnotation(selectedHolon);
				}
			}
		}
	}
	VIEWER.decreaseSelectedHolonSize = decreaseSelectedHolonSize;

	var deleteLink = function(lid)
	{
		console.log("delete link")

		if (BROWSER.cache.l[lid])
		{
			for (var i = BROWSER.cache.l[lid].__hi.length - 1; i >= 0; i--)
			{
				var hi = BROWSER.cache.l[lid].__hi[i];

				var h, p;
				if (hi.parent && hi.parent._id)
				{
					h = BROWSER.cache.h[hi.parent._id];
					p = hi.parent;
				}

				hi.parent.removeChild(hi);

				var an = hi.annotation;
				if (an)
				{
					delete hi.annotation;
					stage.removeChild(an);
				}

				hi = null;

			};

			var index = BROWSER.cache.h[BROWSER.cache.l[lid]._ti].__l.indexOf(lid);
			if (index > -1) {
			    BROWSER.cache.h[BROWSER.cache.l[lid]._ti].__l.splice(index, 1);
			}

			if (parentHolon && parentHolon._l == lid)
			{
				holonTrail = [];
				parentHolon = null;
			}
		}
	}
	VIEWER.deleteLink = deleteLink;

	// Destroy existing link (i.e., to draggingHolon) and create new link in dropTarget 
	var moveHolon = function(h, dropTarget, newX, newY)
	{
		deleteLink(h._l);

		CORELINK.emit('create_link', {
            _fi: h._id,
            _ti: dropTarget._id,
            l: {
                x: newX,
                y: newY,
                s: h._ls
            }
        } );

		CORELINK.destroyLink( h._l );
		delete BROWSER.cache.l[h._l];
	}

	VIEWER.getSelectedHolon = function()
	{
		if (selectedHolon && BROWSER.cache.h[selectedHolon._id])
			return BROWSER.cache.h[selectedHolon._id];
	}

	// Delete (unlink) selected holon
	var unlinkSelectedHolon = function()
	{
		if (selectedHolon && canEditLink(BROWSER.cache.l[selectedHolon._l]))
		{
			var lid = selectedHolon._l;
			var _fi = BROWSER.cache.l[selectedHolon._l]._fi;

			deleteLink(lid);

			selectedHolon = null;

			CORELINK.destroyLink( lid, _fi);
			delete BROWSER.cache.l[lid];

			RING.hideResizeAndDeleteButtons();

        	INFOPANEL.updateContent( BROWSER.cache.h[targetHolon._id] );
		}
	}
	VIEWER.unlinkSelectedHolon = unlinkSelectedHolon;

	VIEWER.loggedOut = function()
	{
		if (RING)
		{
			RING.hideAddButtons();
		}
	}

	VIEWER.isLoggedIn = function()
	{
		if (BROWSER.username)
			return true;
		else
			return false;
	}

	VIEWER.loggedIn = function()
	{
		if (RING)
		{
			RING.showAddButtons();
		}
	}

	VIEWER.infoPanelResized = function(w)
	{
		resize(w);
	}

	var resize = function(w)
	{
		viewWidth = self.innerWidth;

		if (!w)
			INFOPANEL.onWindowResize();

		var wi;
		if (EMBEDDED)
			wi = 0;
		else
			wi = Math.min(500, window.innerWidth - 624);

		if (INFOPANEL)
			wi = INFOPANEL.getCurrentWidth();

		availableWidth = viewWidth - wi;

		viewHeight = self.innerHeight;
		updateViewerGeometry();

		if (targetHolon)
		{
			targetHolon.width = VIEWER.geom.diam;
			targetHolon.height = VIEWER.geom.diam;
		}

		VIEWER.container.position.x = VIEWER.geom.x;
		VIEWER.container.position.y = VIEWER.geom.y;

		VIEWER.renderer.resize(viewWidth, viewHeight);

		targetHolonContainer.position.x = VIEWER.geom.x;
		targetHolonContainer.position.y = VIEWER.geom.y;

		holonTitle.position.x = VIEWER.geom.x;
		holonTitle.position.y = VIEWER.geom.y - VIEWER.geom.diam/2 - VIEWER.geom.ringSize;

		RING.resize();
		if (NAVBAR)
			NAVBAR.resize(availableWidth);

		if (targetHolon && targetHolon.children)
		{
			for (var i = targetHolon.children.length - 1; i >= 0; i--)
			{
				var h = targetHolon.children[i];
				if (h.isHolon && h.annotation)
					positionHolonAnnotation(h);
			};
		}

		circleShade.clear();
		circleShade.lineStyle(0, 0);
        circleShade.beginFill(0x000000, 0.3);
        circleShade.drawCircle(VIEWER.geom.x, VIEWER.geom.y, VIEWER.geom.diam/2);

		updateHolonicAddressPosition();
	}
	VIEWER.resize = resize;

	$(window).bind('keydown', function(event)
	{
	    if (event.ctrlKey || event.metaKey)
	    {
	    	if (EMBEDDED || !mouseInViewer(mouseX, mouseY) || INFOPANEL.isEditing())
				return;

	        switch (String.fromCharCode(event.which).toLowerCase())
	        {
		        case 'c':
		            event.preventDefault();

		            if (selectedHolon)
						copiedLink = BROWSER.cache.l[selectedHolon._l];
					else if (targetHolon)
						copiedLink = targetHolon._id;
		            break;

		        case 'v':
		            event.preventDefault();

		            if (copiedLink)
		            {
						CORELINK.copyLink(copiedLink, targetHolon._id);

						justPasted = true;
						setTimeout(function()
						{
							justPasted = false;
						}, 1000);
					}
		        	break;

		        case 'l':
					event.preventDefault();

			        if (selectedHolon && selectedHolon._l)
					{
						var l = BROWSER.cache.l[selectedHolon._l];

						if (l)
						{
							var canEditLink = false;

							var pholon = BROWSER.cache.h[l._ti];
							if (BROWSER.username && (l._u == BROWSER.username || (pholon && (pholon._u == BROWSER.username || (pholon._pe && pholon._pe.indexOf(BROWSER.username) != -1))) ))
								canEditLink = true;

							if (canEditLink)
							{
								if (!l.locked)
								{
									l.locked = true;
								}
								else
								{
									l.locked = false;
								}

								CORELINK.emit('change_link', { l: {_id: l._id, locked: l.locked } } );
							}
						}
					}
					break;

		        case 'm':
					event.preventDefault();

					if (BROWSER.targetHolon || selectedHolon)
					{
						var idToChange = BROWSER.targetHolon._id;

						if (selectedHolon)
							idToChange = selectedHolon._id;

						if (BROWSER.cache.h[idToChange]._t == "prep" || BROWSER.cache.h[idToChange]._t == "profile")
						{
							swal("Type Change Error", "Prep and profile holons cannot be morphed!", "error");
						}
						else
						{
							swal({   title: "Holon Morph",   text: "Enter new Type ID (the type that you want it to be):",   type: "input",   showCancelButton: true,   closeOnConfirm: true,   animation: "slide-from-top",   inputPlaceholder: "Type ID" }, function(inputValue){   if (inputValue === false) return false;      if (inputValue === "") {     swal.showInputError("You need to enter a Type ID!");     return false   }

		                        if (BROWSER.getOntology()[inputValue])
								{
					                CORELINK.emit('change_holon', { h: {_id: idToChange, _t: inputValue } } );
									return true;
								}
								else
								{
									setTimeout(function()
									{
swal("Type Change Error", "Unknown type. The type ID was not found in the ontology cache.", "error");
									}, 10);
									
								}

	                     	});
						}
					}

		        	break;

		        case 'h':
					event.preventDefault();

					swal({   title: "Holon Creation",   text: "Enter Type ID of new holon:",   type: "input",   showCancelButton: true,   closeOnConfirm: true,   animation: "slide-from-top",   inputPlaceholder: "Type ID" }, function(inputValue){   if (inputValue === false) return false;      if (inputValue === "") {     swal.showInputError("You need to enter a Type ID!");     return false   }

						if (BROWSER.getOntology()[inputValue]){
						createHolon(0,0 , {id: inputValue});
						return true;
					}
						else
						{	swal("Holon Creation Error", "Unknown type. The type ID was not found in the ontology cache.", "error");
						}
					});

					break;
		        case 'f':
					event.preventDefault();
		            alert('f');
		        	break;
	        }
	    }
	    // Without modifier:
	    else
	    {
	    	switch (String.fromCharCode(event.which).toLowerCase())
	    	{
	    		case '.':
					event.preventDefault();

					if (EMBEDDED || !mouseInViewer(mouseX, mouseY) || INFOPANEL.isEditing())
						break;

					unlinkSelectedHolon();

	    			break;
	    	}

	    	switch (event.keyCode)
			{
				case 187: // +
					if (EMBEDDED || !mouseInViewer(mouseX, mouseY) || INFOPANEL.isEditing())
						break;
					increaseSelectedHolonSize();
					break;
				case 189: // -
					if (EMBEDDED || !mouseInViewer(mouseX, mouseY) || INFOPANEL.isEditing())
						break;
					decreaseSelectedHolonSize();
					break;
		    }
		}
	});

	var mouseScrolled = function(e)
	{
		if (!mouseInViewer(e.clientX, e.clientY))
			return;

		if (document.getElementById("cropArea").style.visibility == "visible")
			return;

		// Up / Bigger
		if (e.wheelDelta > 0)
		{
			increaseSelectedHolonSize();
		}	
		// Down / Smaller
		else
		{
			decreaseSelectedHolonSize();
		}
	}

	var mouseInViewer = function(x, y)
	{
		if (lineDistance(VIEWER.geom, {x: x, y: y}) <= VIEWER.geom.diam/2)
			return true;
		else
			return false;
	}
	VIEWER.mouseInViewer = mouseInViewer;

	var mouseMoved = function(e)
	{
		mouseX = e.x;
		mouseY = e.y;
	}

	var mouseReleased = function(e)
	{
		if (e.y > 120)
			$("#searchField").blur();
	}

	window.addEventListener('DOMMouseScroll',mouseScrolled,false);	
	document.onmousewheel = mouseScrolled;

	window.addEventListener('mousemove',mouseMoved,false);	
	document.mousemove = mouseMoved;

	window.addEventListener('mouseup',mouseReleased,false);	
	document.mouseup = mouseReleased;

	window.addEventListener('resize', VIEWER.resize, false);

	window.addEventListener('contextmenu', function(ev)
	{
	    ev.preventDefault();

	    if (EMBEDDED || (ev.x < window.innerWidth - INFOPANEL.getCurrentWidth()))
		    VIEWER.zoomOut();
		
	    return false;
	}, false);

	////

	if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = VIEWER;
        }
        exports.VIEWER = VIEWER;
    } else if (typeof define !== 'undefined' && define.amd) {
        define(VIEWER);
    } else {
        root.VIEWER = VIEWER;
    }


}).call(this);