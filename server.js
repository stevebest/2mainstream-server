#!/usr/bin/env node

//
// Usage information
// -----------------
//
var options = require('dreamopt')([
    "Usage: server [options]",

    "Connection options:",
    "  -p, --port PORT     Port to listen to (default: 8080) #int",
    "  -a, --address ADDR  Address to bind to (default is localhost)"
]);

//
// Generally required modules
// --------------------------
//
var http = require('http');

var server = http.createServer(function (req, res) {
  var result = {
    image_id: 1,
    fragment_id: 1,
    offset: 0,
    total_size: 1234567,
    content: "hello"
  };
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result));
});

server.listen(options.port, options.address);
console.log('Server running at http://' + options.address + ':' + options.port);
