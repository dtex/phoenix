var five = require("johnny-five"),
  Barcli = require("barcli"),
  StateMachine = require("javascript-state-machine"),
  Leap = require("leapjs"),
  Tharp = require("tharp");

// var phoenix = {
//
//   positions: {
//     sleep: [
//       [17.25, 5, 8.15],
//       [-17.25, 5, 8.15],
//       [17.25, 5, 0.1],
//       [-17.25, 5, 0.1],
//       [17.25, 5, -8],
//       [-17.25, 5, -8]
//     ]
//   },
//   roll: 0,
//   pitch: 0,
//   yaw: 0
// };

// phoenix.bones.FEMSQ = Math.pow(phoenix.bones.FEMUR, 2);
// phoenix.bones.TIBSQ = Math.pow(phoenix.bones.TIBIA, 2);
// phoenix.bones.TIBFEMx2 = 2 * phoenix.bones.TIBIA * phoenix.bones.FEMUR;

// var legsRender = function( position, progress ) {
//
//   var invalid = false;
//
//   // Solve all our angles
//   for (i = 0; i < this.length; i++) {
//     if (i <= 1) this[String(i)][five.Animation.render]( phoenix, this[i]. position[i], progress, i );
//   }
//
//   // Make sure all the angles are valid
//   for (i = 0; i <= 1; i++) {
//     for (j = 0; j < 3; j++) {
//       if(this[i].angles[j] === false) {
//         //invalid = true;
//       }
//     }
//   }
//
//   for (i = 0; i < this.length; i++) {
//     if (!invalid && i=== 0) {
//       this[i][0].to(this[i].angles[0]);
//       this[i][1].to(this[i].angles[1]);
//       this[i][2].to(this[i].angles[2]);
//     }
//   }
// };
//
// var whiles = 0;

var board = new five.Board().on("ready", function() {

  // Right front leg
  var r1 = new Tharp.Chain({
    actuators: [
      {pin:40, offset: 24, startAt: 0, range: [0, 90] },
      {pin:39, offset: 87, startAt: 78, range: [-80, 78] },
      {pin:38, offset: 165, invert: true, startAt: -140, range: [-160, -10] }
    ],
    chainType: "CoxaY-FemurZ-TibiaZ",
    origin: [4.25, 2.875, 8.15],
    segments: { femur: 7.6125, tibia: 10.4 },
    position: [11.25, 0, 12.15]
  });

  // Left front leg
  var l1 = new Tharp.Chain({
    actuators: [
      {pin:27, offset: -31, startAt: 180, range: [90, 180] },
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
    actuators: [
      {pin:23, offset: -84, startAt: 180, range: [120, 240] },
      {pin:21, offset: -76, startAt: 102, range: [110, 260] },
      {pin:20, offset: -185, invert: true, startAt: 320, range: [180, 340] }
    ],
    chainType: "CoxaY-FemurZ-TibiaZ",
    origin: [-14.25, 0,  0.1],
    segments: { femur: 7.6125, tibia: 10.4 },
    position: [ -14.25, 0, 0.1 ]
  });

  // Right rear leg
  var r3 = new Tharp.Chain({
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
      { name: "sleep", from: "awake", to: "sleep"},
      { name: "pinch", from: "awake", to: "pinching"},
      { name: "wave", from: "awake", to: "waving"},
      { name: "stop", from: ["pinching", "waving", "walking"], to: "awake"}
    ]
  });

  phoenix.animation = new five.Animation(phoenix);

  //   phoenix.bot = {
  //   "@@render": function(pos) {
  //     phoenix.xShift = pos[0][0] || phoenix.xShift;
  //     phoenix.height = pos[0][1] || phoenix.height;
  //     phoenix.zShift = pos[0][2] || phoenix.zShift;
  //     phoenix.render();
  //   },
  //   "@@normalize": function(keyFrames) {
  //     return keyFrames;
  //   }
  // };


  //   positions: {
  //     sleep: [
  //       [17.25, 5, 8.15],
  //       [-17.25, 5, 8.15],
  //       [17.25, 5, 0.1],
  //       [-17.25, 5, 0.1],
  //       [17.25, 5, -8],
  //       [-17.25, 5, -8]
  //     ]
  //   },

  // To sleep
  var sleep = {
    duration: 2500,
    cuePoints: [0, 0.5, 0.75, 1.0],
    easing: "outQuad",
    oncomplete: function() {
      phoenix.state = "sleep";
    },
    keyFrames: [
      [null, { position: [false, 1, false] }, { position: [17.25, 5, 8.15] }, { position: [17.25, 1, 8.15] } ],
      [null, { position: [false, 1, false] }, { position: [-17.25, 5, 8.15] }, { position: [-17.25, 1, 8.15] } ],
      [null, { position: [false, 1, false] }, { position: [17.25, 5, 0.1] }, { position: [17.25, 1, 0.1] } ],
      [null, { position: [false, 1, false] }, { position: [-17.25, 5, 0.1] }, { position: [-17.25, 1, 0.1] } ],
      [null, { position: [false, 1, false] }, { position: [17.25, 5, -8] }, { position: [17.25, 1, -8] } ],
      [null, { position: [false, 1, false] }, { position: [-17.25, 5, -8] }, { position: [-17.25, 1, -8] } ]
    ]
  };

  phoenix.sleep = function() {
    phoenix.animation.enqueue(sleep);
  };

//
// // ph.r1["@@render"]([11.25, 0, 12.15])
//   phoenix.render = function() {
//     phoenix.legs[five.Animation.render]([
//       [11.25 - phoenix.xShift, 0 - phoenix.height, 12.15 + phoenix.zShift],
//       [-11.25 - phoenix.xShift, 0 - phoenix.height, 12.15 + phoenix.zShift],
//       [14.25 - phoenix.xShift, 0 - phoenix.height, 0.1 + phoenix.zShift],
//       [-14.25 - phoenix.xShift, 0 - phoenix.height, 0.1 + phoenix.zShift],
//       [11.2 - phoenix.xShift, 0 - phoenix.height, -12 + phoenix.zShift],
//       [-11.25 - phoenix.xShift, 0 - phoenix.height, -12 + phoenix.zShift]
//     ]);
//     phoenix.locked = true;
//     GLOBAL.setTimeout(function() {phoenix.locked = false;}, 1000/400);
//   };
//
//   phoenix.stand = {
//     target: phoenix.bot,
//     duration: 2000,
//     cuePoints: [0, 0.5, 1.0],
//     oncomplete: function() {
//       phoenix.state = "stand";
//     },
//     keyFrames: [
//       [{position: [null, 0, null]}, {position: [null, -2, null]}, {position: [null, 8, null]}]
//     ]
//   };
//
//   phoenix.s = function() {
//     phoenix.animation.enqueue(phoenix.stand);
//   };
//
  this.repl.inject({
     ph: phoenix
  });
  phoenix["@@render"](
    [
      [17.25, 1, 8.15],
      [-17.25, 1, 8.15],
      [17.25, 1, 0.1],
      [-17.25, 1, 0.1],
      [17.25, 1, -8],
      [-17.25, 1, -8]
    ]
  );
});

// Leap.loop({enableGestures: true}, function(frame) {
//
//   if (frame.hands.length === 1) {
//     if (!phoenix.locked) {
//
//       var x = phUtils.fmap(frame.hands[0].palmPosition[0], -100, 100, -8, 8);
//       var y = phUtils.fmap(frame.hands[0].palmPosition[1], 50, 400, 0, 10);
//       var z = phUtils.fmap(frame.hands[0].palmPosition[2], -50, 50, -4.5, 4.5);
//
//       phoenix.offset = [x, y, z];
//
//       phoenix.orientation.pitch = phUtils.fmap(frame.hands[0].pitch(), -0.75, 0.75, -0.25, 0.25);
//       phoenix.orientation.roll = phUtils.fmap(frame.hands[0].roll(), -0.75, 0.75, -0.25, 0.25);
//       phoenix.orientation.yaw = phUtils.fmap(frame.hands[0].yaw(), -0.75, 0.75, -0.25, 0.25);
//
//       xMeter.update(x);
//       yMeter.update(y);
//       zMeter.update(z);
//
//       yawMeter.update(phoenix.orientation.yaw);
//       rollMeter.update(phoenix.orientation.roll);
//       pitchMeter.update(phoenix.orientation.pitch);
//
//       phoenix.render();
//     }
//   }
//
//   if (frame.hands.length === 0 && phoenix.state !== "stand" && phoenix.state !== "sleep") {
//     //setState('stop');
//   }
//
// });
//
// var yMeter = new Barcli({label: "Height", range: [0, 10], precision: 4});
// var xMeter = new Barcli({label: "X Offset", range: [-8, 8], constrain: true, precision: 4 });
// var zMeter = new Barcli({label: "Z Offset", range: [-4.5, 4.5], constrain: true, precision: 4 });
//
// var yawMeter = new Barcli({label: "Yaw", range: [-0.25, 0.25], precision: 4});
// var rollMeter = new Barcli({label: "Roll", range: [-0.25, 0.25], precision: 4});
// var pitchMeter = new Barcli({label: "Pitch", range: [-0.25, 0.25], precision: 4});
