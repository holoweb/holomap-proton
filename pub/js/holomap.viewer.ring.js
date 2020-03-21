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

    var RING = {};
    var root = this;
    
    var VIEWER;

    var buttons = {modifier:{}, creator:{}};
    var creationArc;
    var ringRadius;

    //
    // Ring
    //

    RING.init = function(_VIEWER)
    {
        console.log("RING init");
        VIEWER = _VIEWER;

        creationArc = {};
        creationArc.container = new PIXI.DisplayObjectContainer();
        creationArc.graphics = {};
        creationArc.bgGraphics = new PIXI.Graphics();
        creationArc.container.addChild(creationArc.bgGraphics);
        creationArc.container.alpha = 0;
        VIEWER.container.addChild(creationArc.container);
        TweenMax.to(creationArc.container, 0.5, {alpha:1});

        makeButton('increase', 'modifier', function(){ VIEWER.increaseSelectedHolonSize() });
        makeButton('decrease', 'modifier', function(){ VIEWER.decreaseSelectedHolonSize() });
        makeButton('delete', 'modifier', function() { VIEWER.unlinkSelectedHolon(); });

        var ids = Object.keys(buttons['modifier']);
        for (var i = 0; i < ids.length; i++)
            VIEWER.container.addChild(buttons['modifier'][ids[i]]);

        setupRing();

        TweenMax.to(VIEWER.container, 1, {alpha:1});
    };

    var setupRing = function()
    {
        ringRadius = VIEWER.geom.diam/2 + VIEWER.geom.ringSize/2;
        setButtonPosition(buttons.modifier.increase, -Math.PI/50);
        setButtonPosition(buttons.modifier.decrease, Math.PI/50);
        setButtonPosition(buttons.modifier.delete, 5*Math.PI/50 );
        setCreationButtonPositions();
    };

    //
    // Buttons
    //
    
    var makeButton = function(name, set, func)
    {
        var newButton = new PIXI.DisplayObjectContainer();
        buttons[set][name] = newButton;

        newButton.buttonMode = true;
        newButton.interactive = true;
        newButton.background = new PIXI.Sprite.fromImage("/img/button_background.png");
        newButton.background.anchor.x = 0.5;
        newButton.background.anchor.y = 0.5;
        newButton.addChild(newButton.background);
        
        if (name.substr(0,6) != "create")
        {
            newButton.icon = new PIXI.Sprite.fromImage("/img/"+name+".png");
            newButton.icon.anchor.x = 0.5;
            newButton.icon.anchor.y = 0.5;
            newButton.addChild(newButton.icon);
        }
        
        setupButtonMouseEvents(newButton, func);
        setButtonState(newButton, 'inactive');

        return newButton;
    };

    var setupButtonMouseEvents = function(b, f)
    {
        b.mouseover = function()
        {
            setButtonState(b, 'over');
        };
        b.mouseout = function()
        {
            setButtonState(b, 'inactive');
        };
        b.mousedown = b.touchstart = function()
        {
            f(); setButtonState(b, 'pressed');
        };
        b.mouseup = b.touchend = function()
        {
            setButtonState(b, 'over');
        };
        b.mouseupoutside = b.touchendoutside = function()
        {
            setButtonState(b, 'inactive');
        };
    }

    var setButtonState = function(b, state)
    {
        b.state = state;

        var stateStyle = {
            inactive: {alpha: 0.7, fadeTime: 0.5, tint: {background: 0x000000, icon: 0xFFFFFF}},
            over: {alpha: 1.0, fadeTime: 0.25},
            pressed: {alpha: 0.5, fadeTime: 0.1},
            disabled: {alpha: 0.2, fadeTime: 0.2}
        };

        if (b.holon && b.holon.colour)
        {
            if (!stateStyle[state].tint) stateStyle[state].tint = {};
            stateStyle[state].tint.background = stateStyle[state].tint.icon = b.holon.colour;
        }

        VIEWER.resetFrameRate();
        TweenMax.killTweensOf(b);
        TweenMax.to(b, stateStyle[state].fadeTime, {alpha:stateStyle[state].alpha});

        if (stateStyle[state].tint)
        {
            b.background.tint = stateStyle[state].tint.background;
            if (b.icon)
                b.icon.tint = stateStyle[state].tint.icon;
        }
    };

    var setButtonPosition = function(b, t)
    {
        if (!b) return;
        b.position.x = Math.cos(t)*ringRadius;
        b.position.y = Math.sin(t)*ringRadius;
    };

    var enable = function(btn)
    {
        if (!btn) return;
        setButtonState(btn, 'inactive');
        btn.interactive = true; 
    };

    var disable = function(btn)
    {
        if (!btn) return;
        setButtonState(btn, 'disabled');
        btn.interactive = false; 
    };

    //
    // Creation Arc (where holon creation buttons are added)
    //

    var setCreationButtonPositions = function()
    {
        var ids = Object.keys(buttons['creator']);
        for(var i = 0; i < ids.length; i++)
            setButtonPosition(buttons.creator[ids[i]], -(i*0.11) - Math.PI + Math.PI / 5);
    };


    var drag = function(self, event)
    {
        if (!self.dragData) return;
        if (event.originalEvent.touches && event.originalEvent.touches.length > 0)
        {
            self.dragData.container.x = event.originalEvent.touches[0].clientX - VIEWER.container.x;
            self.dragData.container.y = event.originalEvent.touches[0].clientY - VIEWER.container.y;
        }
        else
        {
            self.dragData.container.x = event.originalEvent.x - VIEWER.container.x;
            self.dragData.container.y = event.originalEvent.y - VIEWER.container.y;
        }
    };

    var drop = function(self, event, holon)
    {
        if (event.originalEvent.changedTouches && VIEWER.mouseInViewer(event.originalEvent.changedTouches[0].clientX, event.originalEvent.changedTouches[0].clientY))
            VIEWER.createHolon(event.originalEvent.changedTouches[0].clientX-VIEWER.container.x, event.originalEvent.changedTouches[0].clientY-VIEWER.container.y, holon);
        else if (VIEWER.mouseInViewer(event.originalEvent.x, event.originalEvent.y))
            VIEWER.createHolon(event.originalEvent.x-VIEWER.container.x, event.originalEvent.y-VIEWER.container.y, holon);

        if (self.dragData)
        {
            if (self.dragData.container) VIEWER.container.removeChild(self.dragData.container);
            delete self.dragData;
        }
    };

    var makeHolonCreationButton = function(holon)
    {
        var button = makeButton('create-'+holon.id, 'creator', function(){});
        button.holon = holon;
        button.icon = new PIXI.Sprite.fromImage("/img/button_background.png");
        button.icon.anchor.x = button.icon.anchor.y = 0.5;
        button.addChild(button.icon);
        setButtonState(button, 'inactive');

        button.dragContainer = new PIXI.DisplayObjectContainer();
        button.dragContainer.background = new PIXI.Sprite.fromImage("/img/default.png");
        button.dragContainer.background.anchor.x = button.dragContainer.background.anchor.y = 0.5;
        button.dragContainer.background.tint = holon.colour;
        button.dragContainer.addChild(button.dragContainer.background);

        if (holon.id != '*')
        {
            button.typeText = new PIXI.Text(holon.type, {font: "10pt archivo_regular", fill: "#000000", align: "center"});
            button.typeText.anchor.x = button.typeText.anchor.y = 0.5;
            button.typeText.x = 0;
            button.typeText.y = 2.5; 

            button.dragContainer.text = new PIXI.Text(holon.type, {font: "130pt archivo_regular", fill: "#FFFFFF", align: "center"});
            button.dragContainer.text.anchor.x = button.dragContainer.text.anchor.y = 0.5;
            button.dragContainer.text.x = -7; 
            button.dragContainer.text.y = -7;
        }
        else
        {
            button.typeText = new PIXI.Sprite.fromImage("/img/create.png");
            button.typeText.anchor.x = button.typeText.anchor.y = 0.5;
            button.typeText.tint = 0x000000;

            button.dragContainer.text = new PIXI.Sprite.fromImage("/img/create.png");
            button.dragContainer.text.anchor.x = button.dragContainer.text.anchor.y = 0.5;
        }

        button.addChild(button.typeText);
        button.dragContainer.text.tint = holon.colour;
        button.dragContainer.text.alpha = 0.25;
        button.dragContainer.addChild(button.dragContainer.text);
        creationArc.container.addChild(button);

        button.mousedown = button.touchstart = function(event)
        {            
            setButtonState(button, 'pressed');
            if (button.dragContainer)
            {
                this.dragData = {container: button.dragContainer};
                if (button.holon) this.dragData.holon = button.holon;
                button.dragContainer.width = button.dragContainer.height = 10;
                if (event.originalEvent.touches && event.originalEvent.touches.length > 0)
                {
                    button.dragContainer.x = event.originalEvent.touches[0].clientX - VIEWER.container.x;
                    button.dragContainer.y = event.originalEvent.touches[0].clientY - VIEWER.container.y;
                }
                else
                {
                    button.dragContainer.x = event.originalEvent.x - VIEWER.container.x;
                    button.dragContainer.y = event.originalEvent.y - VIEWER.container.y;
                }
                TweenMax.to(button.dragContainer, 0.5, {width: 72, height: 72});
                VIEWER.container.addChild(button.dragContainer);
            }
        };

        button.mouseup = button.touchend = function(event)
        {
            setButtonState(button, 'over');
            if (this.dragData && this.dragData.holon == button.holon) drop(this, event, button.holon);
        };
        button.mouseupoutside = button.touchendoutside = function(event)
        {
            setButtonState(button, 'inactive');
            if (this.dragData && this.dragData.holon == button.holon) drop(this, event, button.holon);
        };

        button.touchmove = button.mousemove = function(event)
        {
            if (this.dragData && this.dragData.holon == button.holon) drag(this, event);
        };
    };

    // Viewer functions (called from main viewer module)    

    RING.resize = function()
    {
        setupRing();
    };

    RING.updateHolonCreationArc = function(typeData)
    {
        var ids = Object.keys(buttons['creator']);
        for (var i = 0; i < ids.length; i++)
            creationArc.container.removeChild(buttons['creator'][ids[i]]);

        buttons['creator'] = {};
        makeHolonCreationButton({id: '*', title: 'Holon', type: 'any', colour: 0xFFFFFF}, {tint: {background: 0xFFFFFF, icon: 0xFFFFFF}} );

        for (var i = 0; i < typeData.length; i++)
        {
            var colour = typeData[i].c;
            if (!colour) colour = 0xFFFFFF;
            makeHolonCreationButton({id: typeData[i].id, title: typeData[i].t, type: typeData[i].t.charAt(0).toUpperCase(), colour: colour}, {tint: {background: 0xFFFFFF, icon: colour}} );
        }

        if (creationArc.container)
        {
            creationArc.container.mouseover = function()
            {
                creationArc.container.state = 'over';
                // TODO: show a tooltip
            };
            creationArc.container.mouseout = function()
            {
                creationArc.container.state = 'inactive';
                // TODO: hide a tooltip
            };
            creationArc.container.interactive = true;
        }

        setCreationButtonPositions();
    };

    RING.showResizeAndDeleteButtons = function()
    {
        enable(buttons.modifier.increase);
        enable(buttons.modifier.decrease);
        enable(buttons.modifier.delete);

    };

    RING.hideResizeAndDeleteButtons = function()
    {
        disable(buttons.modifier.increase);
        disable(buttons.modifier.decrease);
        disable(buttons.modifier.delete);
    };

    RING.showAddButtons = function()
    {
        for (var i = 0; i < buttons.creator.length; i++)
            enable(buttons.creator[buttons.creator[i]]);        
    };

    RING.hideAddButtons = function()
    {
        for (var i = 0; i < buttons.creator.length; i++)
            disable(buttons.creator[buttons.creator[i]]);         
    };

    // Module definition
    
	if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = RING;
        }
        exports.RING = RING;
    } else if (typeof define !== 'undefined' && define.amd) {
        define(RING);
    } else {
        root.RING = RING;
    }
}).call(this);