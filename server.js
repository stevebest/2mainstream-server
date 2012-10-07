#!/usr/bin/env node

//
// Usage information
// -----------------
//
var options = require('dreamopt')([
    "Usage: server [options]",

    "Connection options:",
    "  -p, --port PORT     Port to listen to (default: 8080) #int",
    "  -a, --address ADDR  Address to bind to",

    "Misc options:",
    "  -s, --seed SEED     A RNG seed for randomizing fragments size (default: 1) #int"
]);

//
// Generally required modules
// --------------------------
//
var http = require('http');
var fs   = require('fs');
var _    = require('underscore');

//
// Load image files
// ----------------
//

// Global
var images = [];

(function () {
  // A source of repeatable pseudo-random numbers. We need to get chunks of
  // random size, but this size must be the same every time we start a server.
  console.log('options', options);
  var rand = require('./rand')(options.seed);

  // Scan working directory and try finding some image files.
  // Sort them by name and take first five of them.
  _.filter(fs.readdirSync('.'), function (filename) {
    return filename.match(/\.(png|jpe?g|gif|bmp)$/i);
  }).sort().slice(0, 5).forEach(loadImage);

  function loadImage(imageFile, i) {
    var img = fs.readFileSync(imageFile);
    console.log('image %d: %s - %d bytes', i, imageFile, img.length);

    images[i] = {
      image_id: i + 1,
      image_name: imageFile,
      total_size: img.length,
      fragments: pulverize(img)  // slice each image into 100 pieces
    };
  }

  function pulverize(img) {
    var cuts = Array.apply(null, Array(99)).map(function () {
      return 1 + Math.floor((img.length - 2) * rand());
    });
    cuts.push(0, img.length - 1);
    cuts.sort(function (a, b) { return a > b ? 1 : -1; });

    var fragments = [];
    for (var i = 0; i < 100; i++) {
      fragments.push({
        fragment_id: i + 1,
        offset: cuts[i],
        content: img.slice(cuts[i], cuts[i + 1]).toString('base64')
      });
    }
    return fragments;
  }
})();

//
// Handle HTTP requests
// --------------------
//
var server = http.createServer(function (req, res) {
  var image = images[Math.floor(Math.random() * images.length)];
  var fragment = image.fragments[Math.floor(Math.random() * 100)];

  var result = {
    image_id:    image.image_id,
    image_name:  image.image_name,
    fragment_id: fragment.fragment_id,
    offset:      fragment.offset,
    total_size:  image.total_size,
    content:     fragment.content
  };
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result));
});

server.listen(options.port, options.address);
console.log('Server running at http://%s:%d', options.address || 'localhost', options.port);
