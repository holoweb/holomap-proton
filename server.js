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

// -----------------------------------------------------------------------------------------------------------

require('dotenv').load();
holomapPublicRootPath = './pub/';
holomapServerPort = process.env.PORT || 80;

var fs = require('fs');
if (!fs.existsSync('./log')) fs.mkdirSync('./log');

var HolomapCore, HolomapMembrane;

// -----------------------------------------------------------------------------------------------------------

// Require modules

HolomapCore = require('./js/holomap.core.js');
HolomapMembrane = require('./js/holomap.membrane.js');

// Initialise

var core = new HolomapCore();
var membrane = new HolomapMembrane(core);
core.set_membrane(membrane);