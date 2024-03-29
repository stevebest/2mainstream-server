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
var util = require('util');
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
  if (/^\/endpoint[1-5](\?.*)?$/.test(req.url)) {
    return sendImageFragment(req, res);
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

//
// Actually send some useful stuff
//
function sendImageFragment(req, res) {
  var endpoint = req.url.match(/\/endpoint([1-5])/)[1];

  // Pick a random image and fragment
  var image = images[Math.floor(Math.random() * images.length)];
  var fragment = image.fragments[(endpoint-1) * 20 + Math.floor(Math.random() * 20)];

  if (Math.random() < 0.60) {
    console.log('200 chunked');
    respond200(sendChunked, image, fragment);
  } else if (Math.random() < 0.60) {
    console.log('200 whole');
    respond200(sendWhole, image, fragment);
  } else if (Math.random() < 0.60) {
    console.log('200 broken');
    respond200(sendBroken, image, fragment);
  } else if (Math.random() < 0.60) {
    console.log('503');
    respond503();
  } else {
    console.log('timeout');
    // just do nothing and hope client will timeout
  }

  function respond200(sendBody, image, fragment) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    sendBody(image, fragment);
  }

  function respond503(sendBody) {
    res.writeHead(503, { 'Content-Type': 'text/plain' });
    if (typeof sendBody === 'function') {
      sendBody();
    } else {
      res.end('503 Service Unavailable');
    }
  }

  function formResponseObject(image, fragment) {
    return {
      image_id: image.image_id,
      fragment: fragment.fragment_id,
      image_name: image.image_name,
      offset: fragment.offset,
      total_size: image.total_size,
      content: fragment.content
    };
  }

  // Send whole image in one go
  function sendWhole(image, fragment) {
    res.end(JSON.stringify(formResponseObject(image, fragment)));
  }

  // Send body in chunks so that a client has a chance to discard duplicate
  // fragments early.
  function sendChunked(image, fragment) {
    res.write(util.format('{"image_id":%d,"fragment_id":%d,',
      image.image_id, fragment.fragment_id));
    res.write(util.format('"image_name":"%s","offset":%d,"total_size":%d,',
      image.image_name, fragment.offset, image.total_size));

    res.write('"content":"');
    spoonFeed(fragment.content, function () {
      res.end('"}');
    });
  }

  // Send body in chunks slowly and possibly die in the process
  function sendBroken(image, fragment) {
    var body = JSON.stringify(formResponseObject(image, fragment));
    body = body.substr(0, body.length * 2 * Math.random());
    spoonFeed(body, function () {
      res.end();
    }, Math.floor(Math.random() * 1024), Math.floor() * 100 + 10);
  }

  function spoonFeed(text, done, chunkSize, throttleMs) {
    chunkSize = chunkSize || 1024;
    throttleMs = throttleMs || 10;
    var chunk = text.substr(0, chunkSize);
    if (chunk.length === 0) {
      return done();
    }
    res.write(chunk);
    setTimeout(function () {
      spoonFeed(text.substr(chunkSize), done);
    }, throttleMs);
  }
}

server.listen(options.port, options.address);
console.log('Server running at http://%s:%d', options.address || 'localhost', options.port);
