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

var NodeStore;

NodeStore = (function()
{
  var db;

  function NodeStore(dbTitle)
  {
    var Datastore = require('nedb');
    db = new Datastore({ filename: './db', autoload: true });
  }

  NodeStore.prototype.create_node = function(content)
  { 
    var newNode = {};
    newNode.n = content;
    
    db.insert(newNode, function(err)
    {
      if (err)
      {
        console.log("error saving node:", err);
      }
    }); 
  }

  NodeStore.prototype.destroy_node = function(id, callback)
  { 
    db.remove({'n._id': id}, {}, function(err)
    {
      if (err)
      {
        console.log("error deleting node:", err);
        callback(null);
      }
      else
      {
        callback(true);
      }
    }); 
  }

  NodeStore.prototype.get_node_fields = function(query, fields, callback)
  {
    db.findOne(query, function (err, doc)
    {
      if (!err && doc)
        callback(doc.n);
      else
        callback(null);
    });
  }

  NodeStore.prototype.get_node = function(query, callback)
  {
    db.findOne(query, function (err, doc)
    {
      if (!err && doc)
        callback(doc.n);
      else
        callback(null);
    });
  }

  NodeStore.prototype.get_nodes = function(query, callback)
  {
    db.find(query, function (err, docs)
    {
      if (!err && docs)
      {
        var ns = [];
        for (var i = docs.length - 1; i >= 0; i--)
          ns.push(docs[i].n);
        callback(ns);
      }
      else
      {
        console.log("error getting nodes:",err, "---> query ", query);
      }
    });
  }

  NodeStore.prototype.update_node = function(id, updateObject, callback)
  {
    db.update({'n._id': id}, {$set: updateObject}, {}, function(err, res)
    {
      if (err)
      {
        console.log("Error updating node", err);
      }
      else if (!res)
      {
        console.log("Error updating node", err);
      }
      else
      {
        //console.log("Node updated");
        callback();
      }
    });
  }

  return NodeStore;

})();

module.exports = NodeStore;