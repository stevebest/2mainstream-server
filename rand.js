// Linear Congruential Generator from Numerical Recipes
// http://en.wikipedia.org/wiki/Linear_congruential_generator

var a = 1664525;
var c = 1013904223;
var m = 0x100000000; // 2^32

module.exports = function (seed) {
  return function rand() {
    return (seed = (a * seed + c) % m) / m;
  }
}
