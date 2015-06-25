var five = require("johnny-five"),
  Barcli = require("barcli"),
  StateMachine = require("javascript-state-machine"),
  Leap = require("leapjs"),
  Tharp = require("tharp");

var phoenix;

var fmap = function(value, fromLow, fromHigh, toLow, toHigh) {
  return constrain((value - fromLow) * (toHigh - toLow) /
    (fromHigh - fromLow) + toLow, toLow, toHigh);
};

var constrain = function(value, lower, upper) {
  return Math.min(upper, Math.max(lower, value));
};

var board = new five.Board().on("ready", function() {

  // Right front leg
  var r1 = new Tharp.Chain({
    constructor: five.Servos,
    actuators: [
      {pin:40, offset: 24, startAt: 0, range: [0, 90] },
      {pin:39, offset: 87, startAt: 78, range: [-80, 78] },
      {pin:38, offset: 165, invert: true, startAt: -140, range: [-160, -10] }
    ],
    chainType: "CoxaY-FemurZ-TibiaZ",
    origin: [4.25, 2.875, 8.15],
    segments: { femur: 7.6125, tibia: 10.4 },
    position: [11.25, 0, 12.15],
    immediate: true
  });

  // Left front leg
  var l1 = new Tharp.Chain({
    constructor: five.Servos,
    actuators: [
      {pin:27, offset: -31, startAt: 149, range: [90, 180] },
      {pin:26, offset: -77, startAt: 102, range: [110, 260] },
      {pin:25, offset: -176, invert: true, startAt: 320, range: [180, 340] }
    ],
    chainType: "CoxaY-FemurZ-TibiaZ",
    origin: [-4.25, 2.875, 8.15],
    segments: { femur: 7.6125, tibia: 10.4 },
    position: [-11.25, 0, 12.15]
  });

  // Right mid leg
  var r2 = new Tharp.Chain({
    constructor: five.Servos,
    actuators: [
      {pin:49, offset: 86, startAt: 0, range: [-60, 60] },
      {pin:48, offset: 78, startAt: 78, range: [-80, 78] },
      {pin:47, offset: 187, invert: true, startAt: -140, range: [-160, -10] }
    ],
    chainType: "CoxaY-FemurZ-TibiaZ",
    origin: [6.25, 2.875, 0],
    segments: { femur: 7.6125, tibia: 10.4 },
    position: [14.25, 0, 0.1]
  });

  // Left mid leg
  var l2 = new Tharp.Chain({
    constructor: five.Servos,
    actuators: [
      {pin:23, offset: -84, startAt: 180, range: [120, 240] },
      {pin:21, offset: -76, startAt: 102, range: [100, 260] },
      {pin:20, offset: -185, invert: true, startAt: 320, range: [180, 340] }
    ],
    chainType: "CoxaY-FemurZ-TibiaZ",
    origin: [-6.25, 2.875,  0],
    segments: { femur: 7.6125, tibia: 10.4 },
    position: [ -14.25, 0, 0.1 ]
  });

  // Right rear leg
  var r3 = new Tharp.Chain({
    constructor: five.Servos,
    actuators: [
      {pin:45, offset: 155, startAt: 0, range: [-90, 0] },
      {pin:44, offset: 79, startAt: 78, range: [-80, 78] },
      {pin:43, offset: 185, invert: true, startAt: -140, range: [-160, -10] }
    ],
    chainType: "CoxaY-FemurZ-TibiaZ",
    origin: [4.25, 2.875, -8.15],
    segments: { femur: 7.6125, tibia: 10.4 },
    position: [ 11.25, 0, -12 ]
  });

  // Left rear leg
  var l3 = new Tharp.Chain({
    constructor: five.Servos,
    actuators: [
      {pin:19, offset: -141, startAt: 180, range: [161, 235] },
      {pin:18, offset: -83, startAt: 102, range: [110, 260] },
      {pin:17, offset: -182, invert: true, startAt: 320, range: [180, 340] }
    ],
    chainType: "CoxaY-FemurZ-TibiaZ",
    origin: [-4.25, 2.875, -8.15],
    segments: { femur: 7.6125, tibia: 10.4 },
    position: [ -11.25, 0, -12 ]
  });

  var phoenix = new Tharp.Robot({
    robotType: "hexapod",
    chains: [r1, l1, r2, l2, r3, l3],
  });

  phoenix.state = StateMachine.create({
    initial: "asleep",
    events: [
      { name: "wake", from: "asleep", to: "awake"},
      { name: "walk", from: "awake", to: "walking"},
      { name: "sleep", from: "awake", to: "asleep"},
      { name: "pinch", from: "awake", to: "pinching"},
      { name: "wave", from: "awake", to: "waving"},
      { name: "stop", from: ["pinching", "waving", "walking"], to: "awake"}
    ]
  });

  phoenix.animation = new five.Animation(phoenix);

  // To stand from sleep
  var stand = {
    duration: 500,
    cuePoints: [0, 0.4, 0.6, 1.0],
    easing: "linear",
    oncomplete: function() {
      phoenix.state = "sleep";
    },
    keyFrames: [
      [{ position: [12, 1, 8.25] }, { position: [13, 1, 12.25] }, { position: [13, -1, 12.25] }, { position: [13, -3, 12.25] } ],
      [{ position: [-12, 1, 8.25] }, { position: [-13, 1, 12.25] }, { position: [-13, -1, 12.25] }, { position: [-13, -3, 12.25] } ],
      [{ position: [13, 1, 0] }, { position: [15, 1, 0] }, { position: [15, -1, 0] }, { position: [15, -3, 0] } ],
      [{ position: [-13, 1, 0] }, { position: [-15, 1, 0] }, { position: [-15, -1, 0] }, { position: [-15, -3, 0] } ],
      [{ position: [12, 1, -8.25] }, { position: [13, 1, -12.25] }, { position: [13, -1, -12.25] }, { position: [13, -3, -12.25] } ],
      [{ position: [-12, 1, -8.25] }, { position: [-13, 1, -12.25] }, { position: [-13, -1, -12.25] }, { position: [-13, -3, -12.25] } ]
    ]
  };

  // To sleep
  var sleep = {
    duration: 2500,
    cuePoints: [0, 0.5, 0.75, 1.0],
    easing: "outQuad",
    keyFrames: [
      [null, { position: [false, 1, false] }, { position: [13, 0, 8.15] }, { position: [13, 1, 8.15] } ],
      [null, { position: [false, 1, false] }, { position: [-13, 0, 8.15] }, { position: [-13, 1, 8.15] } ],
      [null, { position: [false, 1, false] }, { position: [13, 0, 0.1] }, { position: [13, 1, 0.1] } ],
      [null, { position: [false, 1, false] }, { position: [-13, 0, 0.1] }, { position: [-13, 1, 0.1] } ],
      [null, { position: [false, 1, false] }, { position: [13, 0, -8] }, { position: [13, 1, -8] } ],
      [null, { position: [false, 1, false] }, { position: [-13, 0, -8] }, { position: [-13, 1, -8] } ]
    ]
  };

  // To walk
  var walk = {
    duraion: 5000,
    cuePoints: [0, 0.25, 0.5, 0.75, 1.0],
    keyFrames: [
      [null, { position: [null, 1, null] }, { position: [0, -3, 1] }, null, { position: [0, false, -1] }],
      [null, null, { position: [0, false, -1] }, { position: [null, 1, null] }, { position: [0, -3, 1] }],
      [null, { position: [null, 1, null] }, { position: [0, -3, 1] }, null, { position: [0, false, -1] }],
      [null, null, { position: [0, false, -1] }, { position: [null, 1, null] }, { position: [0, -3, 1] }],
      [null, { position: [null, 1, null] }, { position: [0, -3, 1] }, null, { position: [0, false, -1] }],
      [null, null, { position: [0, false, -1] }, { position: [null, 1, null] }, { position: [0, -3, 1] }]
    ]
  };

  phoenix.state.onsleep = function() {
    phoenix.animation.enqueue(sleep);
  };

  phoenix.state.onwake = function() {
    phoenix.animation.enqueue(stand);
  };

  phoenix.roll = function(angle) {
    phoenix.orientation.roll = angle;
    phoenix["@@render"]();
  };

  this.repl.inject({
     ph: phoenix
  });

  phoenix["@@render"](
    [
      [12, 1, 8.25],
      [-12, 1, 8.25],
      [13, 1, 0],
      [-13, 1, 0],
      [12, 1, -8.25],
      [-12, 1, -8.25]
    ]
  );

  var locked = false;

  Leap.loop({enableGestures: true}, function(frame) {

    if (frame.hands.length === 1 && !locked) {

      if (frame.hands[0].grabStrangth > 0.6 && phoenix.state.can("sleep")) {

        phoenix.state.sleep();

      } else {

        if (phoenix.state.current === "asleep") {
          phoenix.state.wake();
        }

        if (phoenix.state && phoenix.state.can && phoenix.state.can("walk")) {
          var x = fmap(frame.hands[0].palmPosition[0], -100, 100, -3, 3);
          var y = fmap(frame.hands[0].palmPosition[1], 50, 400, -1, 4.5);
          var z = fmap(frame.hands[0].palmPosition[2]*-1, -50, 50, -3, 0.5);

          phoenix.offset = [x, y, z];

          if (Math.sqrt(x*x + z*z) > 3) {
            console.log("WALKING");// We should be walking
          }

          phoenix.orientation.pitch = fmap(frame.hands[0].pitch(), -0.5, 0.5, -0.30, 0.3);
          phoenix.orientation.roll = fmap(frame.hands[0].roll() * -1, -0.75, 0.75, -0.25, 0.25);
          phoenix.orientation.yaw = fmap(frame.hands[0].yaw(), -0.5, 0.5, -0.2, 0.2);

          xMeter.update(x);
          yMeter.update(y);
          zMeter.update(z);

          yawMeter.update(phoenix.orientation.yaw);
          rollMeter.update(phoenix.orientation.roll);
          pitchMeter.update(phoenix.orientation.pitch);

          locked = true;
          console.log(phoenix.state.current);

          phoenix["@@render"]();
          GLOBAL.setTimeout(function() {locked = false;}, 1000 / 100);
        }
      }
    }

  });

});


//   if (frame.hands[0].palmPosition[2] > -80 && frame.hands[0].palmPosition[2] < 80) {
//     if (frame.hands[0].direction[0] < -0.4 && frame.hands[0].fingers.length) {
//       setState('left');
//     }
//     if (frame.hands[0].direction[0] > 0.4 && frame.hands[0].fingers.length) {
//       setState('right');
//     }
//     if (frame.hands[0].direction[0] < 0.4 && frame.hands[0].direction[0] > -0.4) {
//       if (phoenix.state === "sleep") {
//         setState('stand');
//       } else {
//         setState('stop');
//       }
//     }
//   } else {
//     if (frame.hands[0].palmPosition[2] > 80 && frame.hands[0].fingers.length === 5) {
//       setState('reverse');
//     }
//     if (frame.hands[0].palmPosition[2] < -80 && frame.hands[0].fingers.length === 5) {
//       setState('forward');
//     }
//   }
// }
















var yMeter = new Barcli({label: "Height", range: [0, 10], precision: 4});
var xMeter = new Barcli({label: "X Offset", range: [-8, 8], constrain: true, precision: 4 });
var zMeter = new Barcli({label: "Z Offset", range: [-4.5, 4.5], constrain: true, precision: 4 });

var yawMeter = new Barcli({label: "Yaw", range: [-0.25, 0.25], precision: 4});
var rollMeter = new Barcli({label: "Roll", range: [-0.25, 0.25], precision: 4});
var pitchMeter = new Barcli({label: "Pitch", range: [-0.25, 0.25], precision: 4});
