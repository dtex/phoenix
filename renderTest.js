var render = require("./legRender.js");

var test = function(position, bot, expect) {
  var pass = true;

  var R1 = render.eePosition(position, bot);
  R1.forEach(function(val, index) {
      if (val !== expect.R1[index]) {
        pass = false;
      }
  });
  if (!pass) console.log("R1 failed", R1);

};

// Leg R1. Home position, no roll, yaw or pitch
test(
  [11.25, -4, 12.15],
  { roll: 0, pitch: 0, yaw: 0 },
  {
    R1: [11.25, -4, 12.15]
  }
);

test(
  [11.25, -4, 12.15],
  { roll: 0.25, pitch: 0, yaw: 0 },
  {
    R1: [11.889880581269, -1.092355145225, 12.15]
  }
);

test(
  [11.25, -4, 12.15],
  { roll: -0.25, pitch: 0, yaw: 0 },
  {
    R1: [ 9.910648907229, -6.658944228463, 12.15 ]
  }
);
