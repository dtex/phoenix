/**
 * This example is used to control a Lynxmotion Phoenix hexapod
 * via an Arduino Mega and DFRobot Mega Sensor Shield
 *
 * Robot
 * http://www.lynxmotion.com/c-117-phoenix.aspx
 * http://arduino.cc/en/Main/ArduinoBoardMegaADK
 * http://www.dfrobot.com/index.php?route=product/product&path=35_124&product_id=560
 *
 * You will want to update a couple of things for your robot:
 * 1. You can tweak your walk with the "lift", "h" and "s" objects.
 * 2. You can trim your servos by changing the offset values on each servo
 *
 */

 var five = require("johnny-five"),
  temporal = require("temporal"),
  vector = require("vektor").vector,
  rotate = require("vektor").rotate,
  matrix = require("vektor").matrix,
  Animation = five.Animation,
  _ = require("underscore"),
  Leap = require("leapjs"),
  board, phoenix = { state: "sleep" },
  easeIn = "inQuad",
  easeOut = "outQuad",
  easeInOut = "inOutQuad",
  framerate = 100,
  gaits = ["row", "crawl", "walk", "run"],
  gait = 0,
  gestureID = 0,

  // This object describes the "leg lift" used in walking
  lift = { femur: 30, tibia: -20 },

  // This object contains the home positions of each
  // servo in its forward, mid and rear position for
  // walking.
  h = {
    f: {
      c: [57, 70, 90],
      f: [116, 120, 119],
      t: [97, 110, 116],
    },
    m: {
      c: [71, 88, 108],
      f: [116, 117, 116],
      t: [102, 106, 104]
    },
    r: {
      c: [57, 70, 90],
      f: [116, 120, 119],
      t: [97, 110, 116]
    }
  },

  // This object contains the home positions of each
  // end effector in its forward, mid and rear position for
  // walking.
  i = {
    f: [
      [11.75, -7.75, 9],
      [11.75, -7.75, 5],
      [11.75, -7.75, 1]
    ],
    m: [
      [11.75, -7.75, 3],
      [11.75, -7.75, -1],
      [11.75, -7.75, -5]
    ],
    r: [
      [11.75, -7.75, -1],
      [11.75, -7.75, -5],
      [11.75, -7.75, -9]
    ]
  },

  // This object contains our end effector positions for turns
  t = {
    f: {
      c: [56, 70, 85 ],
      f: [121, 120, 119],
      t: [117, 110, 105]
    },
    m: {
      c: [73, 88, 105],
      f: [118, 117, 118],
      t: [107, 106, 107]
    },
    r: {
      c: [56, 70, 85 ],
      f: [121, 120, 119],
      t: [117, 110, 105]
    }
  },

  // This object contains the home positions of each
  // servo for the seven steps in walk and crawl.
  s = {
    f: {
      c: [56, 59, 65, 70, 76, 82, 91],
      f: [116, 117,119, 120, 120, 119, 119],
      t: [97, 101, 106, 110, 112, 114, 116]
    },
    m: {
      c: [70, 76, 82, 88, 94, 100, 109],
      f: [116, 119, 118, 117, 118, 117, 116],
      t: [102, 105, 106, 106, 108, 106, 104]
    },
    r: {
      c: [91, 82, 76, 70, 65, 59, 56],
      f: [119, 119,120, 120, 119, 117, 116],
      t: [116, 114, 112, 110, 106, 101, 97]
    }
  },

  // This object contains the sleep positions for our legs
  l = [7, 3, 0];

  la = {
    c: 0,
    f: 80,
    t: 10
  };

var fmap = function(x, fromLow, fromHigh, toLow, toHigh) {
  return (x - fromLow) * (toHigh - toLow) /
    (fromHigh - fromLow) + toLow;
};

function nanosleep(ns) {
  var start = process.hrtime();
  while (process.hrtime() < start + ns) {}
}

var board = new five.Board().on("ready", function() {

  phoenix.led = new five.Led("A1");

  var coxaVector = new vector(2.875, 0, 0);
  var coxaMatrix = new matrix(1,3);
  coxaMatrix.m[0] = coxaVector.v;

  var radToDeg = function(x) {
    return x / Math.PI * 180;
  };

  var solveAngle = function(a, b, c) {
    return Math.acos((a * a + b * b - c * c) / (2 * a * b));
  };

  var legRender = function( position, progress ) {

    // Constants
    var FEMUR = 7.6125;
    var TIBIA = 10.4;
    var FEMSQ = Math.pow(FEMUR, 2);
    var TIBSQ = Math.pow(TIBIA, 2);
    var TIBFEMx2 = 2*TIBIA*FEMUR;

    for (i = 0; i < this.length; i++) {
      var leg = this[i];
      var pos = position[i];

      var coxaAngle = Math.atan(pos[2]/pos[0]);
      var coxaEndpoint = coxaMatrix.dot(rotate.RotY(coxaAngle)).m[0];
      var coxaEndpointV = new vector(coxaEndpoint);

      var xd = pos[0]-coxaEndpointV.x;
	    var yd = pos[1]-coxaEndpointV.y;
      var zd = pos[2]-coxaEndpointV.z;

      var xd_sq = xd * xd;
      var yd_sq = yd * yd;
      var zd_sq = zd * zd;

	    var hypot = Math.sqrt(xd_sq + yd_sq + zd_sq);
      var hypot2d = Math.sqrt(xd_sq + zd_sq);

      var femurAngle = solveAngle(hypot, FEMUR, TIBIA) + Math.sin(yd/hypot2d);
      var tibiaAngle = solveAngle(FEMUR, TIBIA, hypot);

      leg[0].to(radToDeg(coxaAngle));
      leg[1].to(radToDeg(femurAngle));
      leg[2].to(radToDeg(tibiaAngle));
    }

  };

  // Right front leg
  phoenix.r1c = new five.Servo({pin:40, offset: 157, startAt: la.c, range: [-1, 88], isInverted: true });
  phoenix.r1f = new five.Servo({pin:39, offset: 88, startAt:  la.f, range: [69, 177] });
  phoenix.r1t = new five.Servo({pin:38, offset: 90, startAt: la.t, range: [0, 165] });
  phoenix.r1 = new five.Servo.Array([ phoenix.r1c, phoenix.r1f, phoenix.r1t ]);

  //Left front leg
  phoenix.l1c = new five.Servo({pin:27, offset: 79, startAt: la.c, range: [50, 180], isInverted: true });
  phoenix.l1f = new five.Servo({pin:26, offset: 82, startAt: la.f, range: [25, 165], isInverted: true});
  phoenix.l1t = new five.Servo({pin:25, offset: -1, startAt: la.t });
  phoenix.l1 = new five.Servo.Array([ phoenix.l1c, phoenix.l1f, phoenix.l1t ]);

  //Right mid leg
  phoenix.r2c = new five.Servo({pin:49, offset: 98, startAt: la.c, range: [50, 130] });
  phoenix.r2f = new five.Servo({pin:48, offset: 81, startAt: la.f, range: [25, 165] });
  phoenix.r2t = new five.Servo({pin:47, offset: 7, startAt: la.t, isInverted: true });
  phoenix.r2 = new five.Servo.Array([ phoenix.r2c, phoenix.r2f, phoenix.r2t ]);

  //Left mid leg
  phoenix.l2c = new five.Servo({pin:23, offset: 83, startAt: la.c, range: [50, 130], isInverted: true });
  phoenix.l2f = new five.Servo({pin:21, offset: 85, startAt: la.f, range: [25, 165], isInverted: true });
  phoenix.l2t = new five.Servo({pin:20, offset: 6, startAt: la.t });
  phoenix.l2 = new five.Servo.Array([ phoenix.l2c, phoenix.l2f, phoenix.l2t ]);

  //Right rear leg
  phoenix.r3c = new five.Servo({pin:45, offset: 156, startAt: la.c, range: [50, 180] });
  phoenix.r3f = new five.Servo({pin:44, offset: 79, startAt: la.f, range: [25, 165] });
  phoenix.r3t = new five.Servo({pin:43, offset: 4, startAt: la.t, isInverted: true });
  phoenix.r3 = new five.Servo.Array([ phoenix.r3c, phoenix.r3f, phoenix.r3t ]);

  //Left rear leg
  phoenix.l3c = new five.Servo({pin:19, offset: 102, startAt: la.c, range: [50, 180], isInverted: true });
  phoenix.l3f = new five.Servo({pin:18, offset: 82, startAt: la.f, range: [25, 165], isInverted: true });
  phoenix.l3t = new five.Servo({pin:17, offset: 12, startAt: la.t });
  phoenix.l3 = new five.Servo.Array([ phoenix.l3c, phoenix.l3f, phoenix.l3t ]);

    //Servos grouped by joints (used in stand and sleep)
    phoenix.femurs = new five.Servo.Array([phoenix.r1f, phoenix.l1f, phoenix.r2f, phoenix.l2f, phoenix.r3f, phoenix.l3f]);
    phoenix.tibia = new five.Servo.Array([phoenix.r1t, phoenix.l1t, phoenix.r2t, phoenix.l2t, phoenix.r3t, phoenix.l3t]);
    phoenix.coxa = new five.Servo.Array([phoenix.r1c, phoenix.l1c, phoenix.r2c, phoenix.l2c, phoenix.r3c, phoenix.l3c]);
    phoenix.innerCoxa = new five.Servo.Array([phoenix.r2c, phoenix.l2c]);
    phoenix.outerCoxa = new five.Servo.Array([phoenix.r1c, phoenix.l1c, phoenix.r3c, phoenix.l3c]);

  // Servos grouped by joints & leg pairs (used in row)
  phoenix.frontCoxa = new five.Servo.Array([phoenix.r1c, phoenix.l1c]);
  phoenix.frontFemur = new five.Servo.Array([phoenix.r1f, phoenix.l1f]);
  phoenix.frontTibia = new five.Servo.Array([phoenix.r1t, phoenix.l1t]);
  phoenix.midCoxa = new five.Servo.Array([phoenix.r2c, phoenix.l2c]);
  phoenix.midFemur = new five.Servo.Array([phoenix.r2f, phoenix.l2f]);
  phoenix.midTibia = new five.Servo.Array([phoenix.r2t, phoenix.l2t]);
  phoenix.rearCoxa = new five.Servo.Array([phoenix.r3c, phoenix.l3c]);
  phoenix.rearFemur = new five.Servo.Array([phoenix.r3f, phoenix.l3f]);
  phoenix.rearTibia = new five.Servo.Array([phoenix.r3t, phoenix.l3t]);

  phoenix.midLegs = new five.Servo.Array([phoenix.midCoxa, phoenix.midFemur, phoenix.midTibia]);

  phoenix.leftOuterCoxa = new five.Servo.Array([phoenix.l1c, phoenix.l3c]);
  phoenix.rightOuterCoxa = new five.Servo.Array([phoenix.r1c, phoenix.r3c]);
  phoenix.leftOuterFemur = new five.Servo.Array([phoenix.l1f, phoenix.l3f]);
  phoenix.rightOuterFemur = new five.Servo.Array([phoenix.r1f, phoenix.r3f]);
  phoenix.leftOuterTibia = new five.Servo.Array([phoenix.l1t, phoenix.l3t]);
  phoenix.rightOuterTibia = new five.Servo.Array([phoenix.r1t, phoenix.r3t]);

  phoenix.jointPairs = new five.Servo.Array([
    phoenix.frontCoxa, phoenix.frontFemur, phoenix.frontTibia,
    phoenix.midCoxa, phoenix.midFemur, phoenix.midTibia,
    phoenix.rearCoxa, phoenix.rearFemur, phoenix.rearTibia
  ]);

  phoenix.joints = new five.Servo.Array([phoenix.coxa, phoenix.femurs, phoenix.tibia]);
  phoenix.altJoints = new five.Servo.Array([phoenix.innerCoxa, phoenix.outerCoxa, phoenix.femurs, phoenix.tibia]);
  phoenix.triJoints = new five.Servo.Array([phoenix.leftOuterCoxa, phoenix.r2c, phoenix.leftOuterFemur, phoenix.r2f, phoenix.leftOuterTibia, phoenix.r2t, phoenix.rightOuterCoxa, phoenix.l2c, phoenix.rightOuterFemur, phoenix.l2f, phoenix.rightOuterTibia, phoenix.l2t]);

  phoenix.legs = new five.Servo.Array([phoenix.r1c, phoenix.r1f, phoenix.r1t, phoenix.l1c, phoenix.l1f, phoenix.l1t, phoenix.r2c, phoenix.r2f, phoenix.r2t, phoenix.l2c, phoenix.l2f, phoenix.l2t, phoenix.r3c, phoenix.r3f, phoenix.r3t, phoenix.l3c, phoenix.l3f, phoenix.l3t]);


  var legsAnimation = new five.Animation(phoenix.legs);

  phoenix.legs2 = new five.Servo.Array([phoenix.r1, phoenix.l1, phoenix.r2, phoenix.l2, phoenix.r3, phoenix.l3]);
  phoenix.legs2[five.Animation.render] = legRender;

  // From sleep to stand
  var stand = {
    target: phoenix.legs2,
    duration: 15000,
    loop: false,
    fps: framerate,
    // lift tibia, turn coxa, set tibia
    cuePoints: [0, 0.3, 0.6, 1.0],//, 0.3, 0.6, 1.0],
    oncomplete: function() {
      phoenix.state = "stand";
    },
    keyFrames: [
      [{position: l}, {position: [i.f[1][0], 3, i.f[1][2]]}, {position: [i.f[1][0], -2.75, i.f[1][2]]}, {position: i.f[1], easing: "outQuad"}],
      [{position: l}, {position: [i.f[1][0], 3, i.f[1][2]]}, {position: [i.f[1][0], -2.75, i.f[1][2]]}, {position: i.f[1], easing: "outQuad"}],
      [{position: l}, {position: [i.m[1][0], 3, i.m[1][2]]}, {position: [i.m[1][0], -2.75, i.m[1][2]]}, {position: i.m[1], easing: "outQuad"}],
      [{position: l}, {position: [i.m[1][0], 3, i.m[1][2]]}, {position: [i.m[1][0], -2.75, i.m[1][2]]}, {position: i.m[1], easing: "outQuad"}],
      [{position: l}, {position: [i.r[1][0], 3, i.r[1][2]]}, {position: [i.r[1][0], -2.75, i.r[1][2]]}, {position: i.r[1], easing: "outQuad"}],
      [{position: l}, {position: [i.r[1][0], 3, i.r[1][2]]}, {position: [i.r[1][0], -2.75, i.r[1][2]]}, {position: i.r[1], easing: "outQuad"}]
    ]
  };

  // From stand to sleep
  var sleep = {
    duration: 1000,
    cuePoints: [0, 0.666, 0.85, 1.0],
    fps: framerate,
    easing: easeOut,
    target: phoenix.legs2,
    oncomplete: function() {
      phoenix.state = "sleep";
      console.log("sleep");
    },
    keyFrames: [
      [{position: i.f[1]}, {position: [i.f[1][0], -2.75, i.f[1][2]]}, {position: [i.f[1][0], 3, i.f[1][2]]}, {position: l}],
      [{position: i.f[1]}, {position: [i.f[1][0], -2.75, i.f[1][2]]}, {position: [i.f[1][0], 3, i.f[1][2]]}, {position: l}],
      [{position: i.m[1]}, {position: [i.m[1][0], -2.75, i.m[1][2]]}, {position: [i.m[1][0], 3, i.m[1][2]]}, {position: l}],
      [{position: i.m[1]}, {position: [i.m[1][0], -2.75, i.m[1][2]]}, {position: [i.m[1][0], 3, i.m[1][2]]}, {position: l}],
      [{position: i.r[1]}, {position: [i.r[1][0], -2.75, i.r[1][2]]}, {position: [i.r[1][0], 3, i.r[1][2]]}, {position: l}],
      [{position: i.r[1]}, {position: [i.r[1][0], -2.75, i.r[1][2]]}, {position: [i.r[1][0], 3, i.r[1][2]]}, {position: l}]
    ]
  };

  // Wave right tibia
  var waveRight = {
    duration: 1500,
    cuePoints: [0, 0.1, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    target: phoenix.r1,
    oncomplete: function() {
      phoenix.state = "stand";
    },
    keyFrames: [
      [null, false, { degrees: 20, easing: easeInOut }, false, false, false, false, false, null, {copyDegrees: 0, easing: easeInOut} ], // r1c
      [null, { step: 55, easing: easeInOut }, false, false, false, false, false, false, { step: -55, easing: easeInOut }, {copyDegrees: 0, easing: easeInOut} ], // r1f
      [null, { degrees: 85, easing: easeInOut }, { degrees: 45, easing: easeInOut }, { step: -15, easing: easeInOut}, { step: 30, easing: easeInOut}, { copyDegrees: 3, easing: easeInOut}, { copyFrame: 4 }, { copyDegrees: 2, easing: easeInOut}, { copyFrame: 1 }, {copyDegrees: 0, easing: easeInOut} ]
    ]
  };

  // Wave left tibia
  var waveLeft = {
    duration: 1500,
    cuePoints: [0, 0.1, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    target: phoenix.l1,
    oncomplete: function() {
      phoenix.state = "stand";
    },
    keyFrames: [
      [null, false, { degrees: 20, easing: easeInOut }, false, false, false, false, false, { degrees: 52, easing: easeInOut }, {copyDegrees: 0, easing: easeInOut} ], // l1c
      [null, { step: 55, easing: easeInOut }, false, false, false, false, false, false, { step: -55, easing: easeInOut }, {copyDegrees: 0, easing: easeInOut} ], // l1f
      [null, { degrees: 85, easing: easeInOut }, { degrees: 45, easing: easeInOut }, { step: -15, easing: easeInOut}, { step: 30, easing: easeInOut}, { copyDegrees: 3, easing: easeInOut}, { copyFrame: 4 }, { copyDegrees: 2, easing: easeInOut}, { copyFrame: 1 }, {copyDegrees: 0, easing: easeInOut} ]
    ]
  };

  // Tripod gait
  phoenix.run = function(dir) {
    var a = dir === "rev" ? 0 : 2,
      b = dir === "rev" ? 2 : 0;

    legsAnimation.enqueue({
      duration: 1000,
      cuePoints: [0, 0.25, 0.5, 0.75, 1.0],
      loop: true,
      fps: framerate,
      onstop: function() { phoenix.att(); },
      oncomplete: function() { },
      keyFrames: [
        [ null, {degrees: h.f.c[1]}, {degrees: h.f.c[a]}, null, {degrees: h.f.c[b]}],
        [ null, {degrees: h.f.f[1]}, {degrees: h.f.f[a]}, { step: lift.femur, easing: easeOut }, {degrees: h.f.f[b], easing: easeIn}],
        [ null, {degrees: h.f.t[1]}, {degrees: h.f.t[a]}, { step: lift.tibia, easing: easeOut }, {degrees: h.f.t[b], easing: easeIn}],

        [ null, null, {degrees: h.f.c[b]}, {degrees: h.f.c[1]}, {degrees: h.f.c[a]}],
        [ null, { step: lift.femur, easing: easeOut }, {degrees: h.f.f[b], easing: easeIn}, {degrees: h.f.f[1]}, {degrees: h.f.f[a]}],
        [ null, { step: lift.tibia, easing: easeOut }, {degrees: h.f.t[b], easing: easeIn}, {degrees: h.f.t[1]}, {degrees: h.f.t[a]}],

        [ null, null, {degrees: h.m.c[b]}, {degrees: h.m.c[1]}, {degrees: h.m.c[a]}],
        [ null, { step: lift.femur, easing: easeOut }, {degrees: h.m.f[b], easing: easeIn}, {degrees: h.m.f[1]}, {degrees: h.m.f[a]}],
        [ null, { step: lift.tibia, easing: easeOut }, {degrees: h.m.t[b], easing: easeIn}, {degrees: h.m.t[1]}, {degrees: h.m.t[a]}],

        [ null, {degrees: h.m.c[1]}, {degrees: h.m.c[a]}, null, {degrees: h.m.c[b]}],
        [ null, {degrees: h.m.f[1]}, {degrees: h.m.f[a]}, { step: lift.femur, easing: easeOut }, {degrees: h.m.f[b], easing: easeIn}],
        [ null, {degrees: h.m.t[1]}, {degrees: h.m.t[a]}, { step: lift.tibia, easing: easeOut }, {degrees: h.m.t[b], easing: easeIn}],

        [ null, {degrees: h.r.c[1]}, {degrees: h.r.c[b]}, null, {degrees: h.r.c[a]}],
        [ null, {degrees: h.r.f[1]}, {degrees: h.r.f[b]}, { step: lift.femur, easing: easeOut }, {degrees: h.r.f[a], easing: easeIn}],
        [ null, {degrees: h.r.t[1]}, {degrees: h.r.t[b]}, { step: lift.tibia, easing: easeOut }, {degrees: h.r.t[a], easing: easeIn}],

        [ null, null, {degrees: h.r.c[a]}, {degrees: h.r.c[1]}, {degrees: h.r.c[b]}],
        [ null, { step: lift.femur, easing: easeOut }, {degrees: h.r.f[a], easing: easeIn}, {degrees: h.r.f[1]}, {degrees: h.r.f[b]}],
        [ null, { step: lift.tibia, easing: easeOut }, {degrees: h.r.t[a], easing: easeIn}, {degrees: h.r.t[1]}, {degrees: h.r.t[b]}],
      ]
    });
    return this;
  };

  // Two leg gait
  var walk = {
    duration: 2000,
    cuePoints: [0, 0.071, 0.143, 0.214, 0.286, 0.357, 0.429, 0.5, 0.571, 0.643, 0.714, 0.786, 0.857, 0.929, 1],
    loop: true,
    loopback: 0.5,
    fps: framerate,
    onstop: function() { phoenix.att(); },
    oncomplete: function() { },
    keyFrames: [
      [null, null, {degrees: s.f.c[5]}, null, null, null, null, {degrees: s.f.c[5]}, null, {degrees: s.f.c[0]}, null, null, null, null, {degrees: s.f.c[5]}], // r1c
      [null, { step: lift.femur, easing: easeOut }, {degrees: s.f.f[5], easing: easeIn}, null, null, null, null, {degrees: s.f.f[5]}, { step: lift.femur, easing: easeOut }, {degrees: s.f.f[0], easing: easeIn}, null, null, null, null, {degrees: s.f.f[5]}],
      [null, { step: lift.tibia, easing: easeOut }, {degrees: s.f.t[5], easing: easeIn}, null, null, null, null, {degrees: s.f.t[5]}, { step: lift.tibia, easing: easeOut }, {degrees: s.f.t[0], easing: easeIn}, null, null, null, null, {degrees: s.f.t[5]}],

      [null, null, null, false, null, {degrees: s.f.c[2]}, null, {degrees: s.f.c[2]}, null, null, {degrees: s.f.c[5]}, null, {degrees: s.f.c[0]}, null, {degrees: s.f.c[2]}],
      [null, null, null, false, { step: lift.femur, easing: easeOut }, {degrees: s.f.f[2], easing: easeIn}, null, {degrees: s.f.f[2]}, null, null, {degrees: s.f.f[5]}, { step: lift.femur, easing: easeOut }, {degrees: s.f.f[0], easing: easeIn}, null, {degrees: s.f.f[2]}],
      [null, null, null, false, { step: lift.tibia, easing: easeOut }, {degrees: s.f.t[2], easing: easeIn}, null, {degrees: s.f.t[2]}, null, null, {degrees: s.f.t[5]}, { step: lift.tibia, easing: easeOut }, {degrees: s.f.t[0], easing: easeIn}, null, {degrees: s.f.t[2]}],

      [null, null, null, null, false, null, {degrees: s.m.c[1]}, {degrees: s.m.c[1]}, null, null, null, {degrees: s.m.c[5]}, null, {degrees: s.m.c[0]}, {degrees: s.m.c[1]}],
      [null, null, null, null, false, { step: lift.femur, easing: easeOut }, {degrees: s.m.f[1], easing: easeIn}, {degrees: s.m.f[1]}, null, null, null, {degrees: s.m.f[5]}, { step: lift.femur, easing: easeOut }, {degrees: s.m.f[0], easing: easeIn}, {degrees: s.m.f[1]}],
      [null, null, null, null, false, { step: lift.tibia, easing: easeOut }, {degrees: s.m.t[1], easing: easeIn}, {degrees: s.m.t[1]}, null, null, null, {degrees: s.m.t[5]}, { step: lift.tibia, easing: easeOut }, {degrees: s.m.t[0], easing: easeIn}, {degrees: s.m.t[1]}],

      [null, false, null, {degrees: s.m.c[4]}, null, null, null, {degrees: s.m.c[4]}, {degrees: s.m.c[5]}, null, {degrees: s.m.c[0]}, null, null, null, {degrees: s.m.c[4]}],
      [null, false, { step: lift.femur, easing: easeOut }, {degrees: s.m.f[4], easing: easeIn}, null, null, null, {degrees: s.m.f[4]}, {degrees: s.m.f[5]}, { step: lift.femur, easing: easeOut }, {degrees: s.m.f[0], easing: easeIn}, null, null, null, {degrees: s.m.f[4]}],
      [null, false, { step: lift.tibia, easing: easeOut }, {degrees: s.m.t[4], easing: easeIn}, null, null, null, {degrees: s.m.t[4]}, {degrees: s.m.t[5]}, { step: lift.tibia, easing: easeOut }, {degrees: s.m.t[0], easing: easeIn}, null, null, null, {degrees: s.m.t[4]}],

      [null, null, false, null, {degrees: s.r.c[3]}, null, null, {degrees: s.r.c[3]}, null, {degrees: s.r.c[5]}, null, {degrees: s.r.c[0]}, {degrees: s.r.c[1]}, null, {degrees: s.r.c[3]}],
      [null, null, false, { step: lift.femur, easing: easeOut }, {degrees: s.r.f[3], easing: easeIn}, null, null, {degrees: s.r.f[3]}, null, {degrees: s.r.f[5]}, { step: lift.femur, easing: easeOut }, {degrees: s.r.f[0], easing: easeIn}, {degrees: s.r.f[1]}, null, {degrees: s.r.f[3]}],
      [null, null, false, { step: lift.tibia, easing: easeOut }, {degrees: s.r.t[3], easing: easeIn}, null, null, {degrees: s.r.t[3]}, null, {degrees: s.r.t[5]}, { step: lift.tibia, easing: easeOut }, {degrees: s.r.t[0], easing: easeIn}, {degrees: s.r.t[1]}, null, {degrees: s.r.t[3]}],

      [null, null, null, null, null, false, null, {degrees: s.r.c[0]}, null, null, null, null, {degrees: s.r.c[5]}, null, {degrees: s.r.c[0]}],
      [null, null, null, null, null, false, { step: lift.femur, easing: easeOut }, {degrees: s.r.f[0], easing: easeIn}, null, null, null, null, {degrees: s.r.f[5]}, { step: lift.femur, easing: easeOut }, {degrees: s.r.f[0], easing: easeIn}],
      [null, null, null, null, null, false, { step: lift.tibia, easing: easeOut }, {degrees: s.r.t[0], easing: easeIn}, null, null, null, null, {degrees: s.r.t[5]}, { step: lift.tibia, easing: easeOut }, {degrees: s.r.t[0], easing: easeIn}]
    ]
  };

  // One leg gait
  var crawl = {
    duration: 2000,
    cuePoints: [0, 0.071, 0.143, 0.214, 0.286, 0.357, 0.429, 0.5, 0.542, 0.583, 0.625, 0.667, 0.708, 0.75, 0.792, 0.833, 0.875, 0.917, 0.958, 1],
    loop: true,
    loopback: 0.5,
    fps: framerate,
    onstop: function() { phoenix.att(); },
    oncomplete: function() { },
    keyFrames: [
      [null, null, {degrees: s.f.c[5]}, null, null, null, null, {degrees: s.f.c[5]}, null, {degrees: s.f.c[0]}, null, null, null, null, null, null, null, null, null, {degrees: s.f.c[5]}],
      [null, { step: lift.femur, easing: easeOut }, {degrees: s.f.f[5], easing: easeIn}, null, null, null, null, {degrees: s.f.f[5]}, { step: lift.femur, easing: easeOut }, {degrees: s.f.f[0], easing: easeIn}, null, null, null, null, null, null, null, null, null, {degrees: s.f.f[5]}],
      [null, { step: lift.tibia, easing: easeOut }, {degrees: s.f.t[5], easing: easeIn}, null, null, null, null, {degrees: s.f.t[5]}, { step: lift.tibia, easing: easeOut }, {degrees: s.f.t[0], easing: easeIn}, null, null, null, null, null, null, null, null, null, {degrees: s.f.t[5]}],

      [null, null, null, false, null, {degrees: s.f.c[2]}, null, {degrees: s.f.c[2]}, null, null, null, null, null, {degrees: s.f.c[5]}, null, {degrees: s.f.c[0]}, null, null, null, {degrees: s.f.c[2]}],
      [null, null, null, false, { step: lift.femur, easing: easeOut }, {degrees: s.f.f[2], easing: easeIn}, null, {degrees: s.f.f[2]}, null, null, null, null, null, {degrees: s.f.f[5]}, { step: lift.femur, easing: easeOut }, {degrees: s.f.f[0], easing: easeIn}, null, null, null, {degrees: s.f.f[2]}],
      [null, null, null, false, { step: lift.tibia, easing: easeOut }, {degrees: s.f.t[2], easing: easeIn}, null, {degrees: s.f.t[2]}, null, null, null, null, null, {degrees: s.f.t[5]}, { step: lift.tibia, easing: easeOut }, {degrees: s.f.t[0], easing: easeIn}, null, null, null, {degrees: s.f.t[2]}],

      [null, null, null, null, false, null, {degrees: s.m.c[1]}, {degrees: s.m.c[1]}, null, null, null, null, null, null, null, {degrees: s.m.c[5]}, null, {degrees: s.m.c[0]}, null, {degrees: s.m.c[1]}],
      [null, null, null, null, false, { step: lift.femur, easing: easeOut }, {degrees: s.m.f[1], easing: easeIn}, {degrees: s.m.f[1]}, null, null, null, null, null, null, null, {degrees: s.m.f[5]}, { step: lift.femur, easing: easeOut }, {degrees: s.m.f[0], easing: easeIn}, null, {degrees: s.m.f[1]}],
      [null, null, null, null, false, { step: lift.tibia, easing: easeOut }, {degrees: s.m.t[1], easing: easeIn}, {degrees: s.m.t[1]}, null, null, null, null, null, null, null, {degrees: s.m.t[5]}, { step: lift.tibia, easing: easeOut }, {degrees: s.m.t[0], easing: easeIn}, null, {degrees: s.m.t[1]}],

      [null, false, null, {degrees: s.m.c[4]}, null, null, null, {degrees: s.m.c[4]}, null, {degrees: s.m.c[5]}, null, {degrees: s.m.c[0]}, null, null, null, null, null, null, null, {degrees: s.m.c[4]}],
      [null, false, { step: lift.femur, easing: easeOut }, {degrees: s.m.f[4], easing: easeIn}, null, null, null, {degrees: s.m.f[4]}, null, {degrees: s.m.f[5]}, { step: lift.femur, easing: easeOut }, {degrees: s.m.f[0], easing: easeIn}, null, null, null, null, null, null, null, {degrees: s.m.f[4]}],
      [null, false, { step: lift.tibia, easing: easeOut }, {degrees: s.m.t[4], easing: easeIn}, null, null, null, {degrees: s.m.t[4]}, null, {degrees: s.m.t[5]}, { step: lift.tibia, easing: easeOut }, {degrees: s.m.t[0], easing: easeIn}, null, null, null, null, null, null, null, {degrees: s.m.t[4]}],

      [null, null, false, null, {degrees: s.r.c[3]}, null, null, {degrees: s.r.c[3]}, null, null, null, {degrees: s.r.c[5]}, null, {degrees: s.r.c[0]}, null, null, null, null, null, {degrees: s.r.c[3]}],
      [null, null, false, { step: lift.femur, easing: easeOut }, {degrees: s.r.f[3], easing: easeIn}, null, null, {degrees: s.r.f[3]}, null, null, null, {degrees: s.r.f[5]}, { step: lift.femur, easing: easeOut }, {degrees: s.r.f[0], easing: easeIn}, null, null, null, null, null, {degrees: s.r.f[3]}],
      [null, null, false, { step: lift.tibia, easing: easeOut }, {degrees: s.r.t[3], easing: easeIn}, null, null, {degrees: s.r.t[3]}, null, null, null, {degrees: s.r.t[5]}, { step: lift.tibia, easing: easeOut }, {degrees: s.r.t[0], easing: easeIn}, null, null, null, null, null, {degrees: s.r.t[3]}],

      [null, null, null, null, null, false, null, {degrees: s.r.c[0]}, null, null, null, null, null, null, null, null, null, {degrees: s.r.c[5]}, null, {degrees: s.r.c[0]}],
      [null, null, null, null, null, false, { step: lift.femur, easing: easeOut }, {degrees: s.r.f[0], easing: easeIn}, null, null, null, null, null, null, null, null, null, {degrees: s.r.f[5]}, { step: lift.femur, easing: easeOut }, {degrees: s.r.f[0], easing: easeIn}],
      [null, null, null, null, null, false, { step: lift.tibia, easing: easeOut }, {degrees: s.r.t[0], easing: easeIn}, null, null, null, null, null, null, null, null, null, {degrees: s.r.t[5]}, { step: lift.tibia, easing: easeOut }, {degrees: s.r.t[0], easing: easeIn}]
    ]
  };

  // Wave gait
  phoenix.row = function(dir) {
    var a = dir === "rev" ? 2 : 0,
      b = dir === "rev" ? 0 : 2;

    legsAnimation.enqueue({
      target: phoenix.jointPairs,
      duration: 1500,
      cuePoints: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.85, 1.0],
      loop: true,
      fps: framerate,
      onstop: function() { phoenix.att(); },
      oncomplete: function() { },
      keyFrames: [

        [null, null, null, null, false, null, {degrees: h.f.c[a]}, false, {degrees: h.f.c[1]}, {degrees: h.f.c[b]}],
        [null, null, null, null, false, { step: lift.femur, easing: easeOut }, {degrees: h.f.f[a]}, false, {degrees: h.f.f[1]}, {degrees: h.f.f[b]}],
        [null, null, null, null, false, { step: lift.tibia, easing: easeOut }, {degrees: h.f.t[a]}, false, {degrees: h.f.t[1]}, {degrees: h.f.t[b]}],

        [null, null, false, null, {degrees: h.m.c[a]}, null, null, false, {degrees: h.m.c[1]}, {degrees: h.m.c[b]}],
        [null, null, false, { step: lift.femur, easing: easeOut }, {degrees: h.m.f[a]}, null, null, false, {degrees: h.m.f[1]}, {degrees: h.m.f[b]}],
        [null, null, false, { step: lift.tibia, easing: easeOut }, {degrees: h.m.t[a]}, null, null, false, {degrees: h.m.t[1]}, {degrees: h.m.t[b]}],

        [null, null, {degrees: h.r.c[b]}, null, null, null, null, false, {degrees: h.r.c[1]}, {degrees: h.r.c[a]}],
        [null, { step: lift.femur, easing: easeOut },  {degrees: h.r.f[b]}, null, null, null, null, false, {degrees: h.r.f[1]}, {degrees: h.r.f[a]}],
        [null, { step: lift.tibia, easing: easeOut }, {degrees: h.r.t[b]}, null, null, null, null, false, {degrees: h.r.t[1]}, {degrees: h.r.t[a]}],

      ]
    });
    return this;
  };

  // Show gait with COG outside of polygon formed by legs
  phoenix.badRow = function(dir) {
    var a = dir === "rev" ? 2 : 0,
      b = dir === "rev" ? 0 : 2;

    legsAnimation.enqueue({
      target: phoenix.jointPairs,
      duration: 1500,
      cuePoints: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.85, 1.0],
      loop: true,
      fps: framerate,
      onstop: function() { phoenix.att(); },
      oncomplete: function() { },
      keyFrames: [
        [null, null, {degrees: h.f.c[a]}, null, null, null, null, false, {degrees: h.f.c[1]}, {degrees: h.f.c[b]}],
        [null, { step: lift.femur, easing: easeOut },  {degrees: h.f.f[a]}, null, null, null, null, false, {degrees: h.f.f[1]}, {degrees: h.f.f[b]}],
        [null, { step: lift.tibia, easing: easeOut }, {degrees: h.f.t[a]}, null, null, null, null, false, {degrees: h.f.t[1]}, {degrees: h.f.t[b]}],

        [null, null, false, null, {degrees: h.m.c[a]}, null, null, false, {degrees: h.m.c[1]}, {degrees: h.m.c[b]}],
        [null, null, false, { step: lift.femur, easing: easeOut }, {degrees: h.m.f[a]}, null, null, false, {degrees: h.m.f[1]}, {degrees: h.m.f[b]}],
        [null, null, false, { step: lift.tibia, easing: easeOut }, {degrees: h.m.t[a]}, null, null, false, {degrees: h.m.t[1]}, {degrees: h.m.t[b]}],

        [null, null, null, null, false, null, {degrees: h.r.c[b]}, false, {degrees: h.r.c[1]}, {degrees: h.r.c[a]}],
        [null, null, null, null, false, { step: lift.femur, easing: easeOut }, {degrees: h.r.f[b]}, false, {degrees: h.r.f[1]}, {degrees: h.r.f[a]}],
        [null, null, null, null, false, { step: lift.tibia, easing: easeOut }, {degrees: h.r.t[b]}, false, {degrees: h.r.t[1]}, {degrees: h.r.t[a]}],
      ]
    });
    return this;
  };

  // Tripod turn
  phoenix.turn = function(dir) {
    var a = dir === "left" ? 2 : 0,
      b = dir === "left" ? 0 : 2;

    legsAnimation.enqueue({
      duration: 2000,
      fps: framerate,
      cuePoints: [0, 0.25, 0.5, 0.625, 0.75, 0.875, 1.0],
      loop: true,
      loopback: 0.5,
      onstop: function() { phoenix.att(); },
      keyFrames: [
        [ null, null, {degrees: t.f.c[a]}, null, {degrees: t.f.c[b]}, null, {degrees: t.f.c[a]}],
        [ null, null, {degrees: t.f.f[a]}, { step: lift.femur, easing: easeOut }, {degrees: t.f.f[b]}, null, {degrees: t.f.f[a]}],
        [ null, null, {degrees: t.f.t[a]}, { step: lift.tibia, easing: easeOut }, {degrees: t.f.t[b]}, null, {degrees: t.f.t[a]}],

        [ null, null, {degrees: t.f.c[a]}, null, {degrees: t.f.c[b]}, null, {degrees: t.f.c[a]}],
        [ null, { step: lift.femur, easing: easeOut }, {degrees: t.f.f[a], easing: easeIn}, null, {degrees: t.f.f[b], easing: easeIn}, { step: lift.femur, easing: easeOut }, {degrees: t.f.f[a], easing: easeIn}],
        [ null, { step: lift.tibia, easing: easeOut }, {degrees: t.f.t[a], easing: easeIn}, null, {degrees: t.f.t[b], easing: easeIn}, { step: lift.tibia, easing: easeOut }, {degrees: t.f.t[a], easing: easeIn}],

        [ null, null, {degrees: t.m.c[b]}, null, {degrees: t.m.c[a]}, null, {degrees: t.m.c[b]}],
        [ null, { step: lift.femur, easing: easeOut }, {degrees: t.m.f[b], easing: easeIn}, null, {degrees: t.m.f[a], easing: easeIn}, { step: lift.femur, easing: easeOut }, {degrees: t.m.f[b], easing: easeIn}],
        [ null, { step: lift.tibia, easing: easeOut }, {degrees: t.m.t[b], easing: easeIn}, null, {degrees: t.m.t[a], easing: easeIn}, { step: lift.tibia, easing: easeOut }, {degrees: t.m.t[b], easing: easeIn}],

        [ null, null, {degrees: t.m.c[b]}, null, {degrees: t.m.c[a]}, null, {degrees: t.m.c[b]}],
        [ null, null, {degrees: t.m.f[b]}, { step: lift.femur, easing: easeOut }, {degrees: t.m.f[a]}, null, {degrees: t.m.f[b]}],
        [ null, null, {degrees: t.m.t[b]}, { step: lift.tibia, easing: easeOut }, {degrees: t.m.t[a]}, null, {degrees: t.m.t[b]}],

        [ null, null, {degrees: t.r.c[b]}, null, {degrees: t.r.c[a]}, null, {degrees: t.r.c[b]}],
        [ null, null, {degrees: t.r.f[b]}, { step: lift.femur, easing: easeOut }, {degrees: t.r.f[a]}, null, {degrees: t.r.f[b]}],
        [ null, null, {degrees: t.r.t[b]}, { step: lift.tibia, easing: easeOut }, {degrees: t.r.t[a]}, null, {degrees: t.r.t[b]}],

        [ null, null, {degrees: t.r.c[b]}, null, {degrees: t.r.c[a]}, null, {degrees: t.r.c[b]}],
        [ null, { step: lift.femur, easing: easeOut }, {degrees: t.r.f[b], easing: easeIn}, null, {degrees: t.r.f[a], easing: easeIn}, { step: lift.femur, easing: easeOut }, {degrees: t.r.f[b], easing: easeIn}],
        [ null, { step: lift.tibia, easing: easeOut }, {degrees: t.r.t[b], easing: easeIn}, null, {degrees: t.r.t[a], easing: easeIn}, { step: lift.tibia, easing: easeOut }, {degrees: t.r.t[b], easing: easeIn}]
      ]
    });

    return this;

  };

  // Return phoenix to home position
  phoenix.att = function() {

    var most = 0, grouped, mostIndex, ani, work = [
      { name: "r1", offset: 0, home: h.f.f[1], thome: h.f.t[1], chome: h.f.c[1]},
      { name: "r2", offset: 0, home: h.m.f[1], thome: h.m.t[1], chome: h.m.c[1] },
      { name: "r3", offset: 0, home: h.r.f[1], thome: h.r.t[1], chome: h.r.c[1] },
      { name: "l1", offset: 0, home: h.f.f[1], thome: h.f.t[1], chome: h.f.c[1] },
      { name: "l2", offset: 0, home: h.m.f[1], thome: h.m.t[1], chome: h.m.c[1] },
      { name: "l3", offset: 0, home: h.r.f[1], thome: h.r.t[1], chome: h.r.c[1] }
    ];

    // Loop through legs and find how far each is from "home"
    work.forEach(function(leg, i) {
      work[i].offset = Math.abs(phoenix[leg.name+"f"].last.target - leg.home);
    });

    var moving = _.max(work, function(leg){ return leg.offset; });

    if (moving.name === "r2" || moving.name === "l1" || moving.name === "l3") {
      grouped = [ [1, 3, 5], [0, 2, 4] ];
    } else {
      grouped = [ [0, 2, 4], [1, 3, 5] ];
    }

    grouped.forEach(function(group, i) {
      group.forEach(function(leg, j) {
        temporal.queue([
          {
            delay: 500*i,
            task: function() {
              phoenix[work[leg].name+"f"].to(work[leg].home + lift.femur);
              phoenix[work[leg].name+"t"].to(work[leg].thome + lift.tibia);
            }
          },
          {
            delay: 100,
            task: function() {
              phoenix[work[leg].name+"c"].to(work[leg].chome);
            }
          },
          {
            delay: 100,
            task: function() {
              phoenix[work[leg].name+"f"].to(work[leg].home);
              phoenix[work[leg].name+"t"].to(work[leg].thome);
            }
          }
        ]);
      });
    });
    phoenix.state = "stand";
  };

  phoenix.sleep = function() {
    legsAnimation.enqueue(sleep);
  };

  phoenix.walk = function() {
    legsAnimation.enqueue(walk);
  };

  phoenix.crawl = function() {
    legsAnimation.enqueue(crawl);
  };

  phoenix.waveLeft = function() {
    legsAnimation.enqueue(waveLeft);
  };

  phoenix.waveRight = function() {
    legsAnimation.enqueue(waveRight);
  };

  phoenix.stand = function() {
    legsAnimation.enqueue(stand);
  };

  phoenix.stop = function() {
    legsAnimation.stop();
  };

  phoenix.setGait = function(newGait) {
    gait = newGait;
  };

  phoenix.go = function( position ) {
    phoenix.legs2["@@render"]([position, position, position, position, position, position]);
  };

  // Inject the `ph` object into
  // the Repl instance's context
  // allows direct command line access
  this.repl.inject({
     ph: phoenix,
     s: phoenix.stop
  });

  var blink = function(count) {
    phoenix.led.blink(125);
    board.wait(count*250, function() {
        phoenix.led.stop().off();
    });
  }

  var setState = function(newState) {
    var now = Date.now();
    if (newState !== phoenix.pendingState) {
        phoenix.pendingState = newState;
        phoenix.newStateTime = now + 250;
    }

    if (now > phoenix.newStateTime && phoenix.State !== newState && phoenix.pendingState !== phoenix.state) {
      switch (newState) {
        case "left":
          if (phoenix.state !== "left") {
            phoenix.state = "left";
            phoenix.turn("left");
          }
          break;
        case "right":
          if (phoenix.state !== "right") {
            phoenix.state = "right";
            phoenix.turn("right");
          }
          break;
        case "stop":
          if (phoenix.state === "forward" || phoenix.state === "reverse" || phoenix.state === "left" || phoenix.state === "right" ) {
            phoenix.state = "stop";
            phoenix.stop();
          }
          break;
        case "reverse":
          if (phoenix.state !== "reverse") {
            phoenix.state = "reverse";
            phoenix.run("rev");
          }
          break;
        case "forward":
          if (phoenix.state !== "forward") {
            phoenix.state = "forward";
            phoenix[gaits[gait]].call();
          }
          break;
        case "pinch":
          legsAnimation.enqueue({
            duration: 250,
            target: phoenix.midLegs,
            cuePoints: [0, 0.5, 1.0],
            keyFrames: [
              [null, null, {degrees: 60 }],
              [null, lift.femur, {copyDegrees: 0}],
              [null, lift.tibia, {copyDegrees: 0}]
            ],
            oncomplete: function() {
              console.log("pinchers");
              phoenix.state = "pinchers";
            }
          });
          break;
        case "sleep":
          if (phoenix.state !== "sleep") {
            phoenix.sleep();
            phoenix.state = "sleep";
            return;
          }
          break;
        case "stand":
          if (phoenix.state === "sleep") {
            phoenix.stand();
          } else {
            phoenix.att();
          }
      }
      phoenix.state = newState;
      console.log(phoenix.state);
    }
  };

  var controller = new Leap.Controller({enableGestures: true});

  controller.on("frame", function(frame) {
    if(frame.gestures.length > 0) {
      if(frame.gestures[0].type === "keyTap" && frame.gestures[0].id !== gestureID && phoenix.state !== "pinchers") {
        gestureID = frame.gestures[0].id;
        gait++;
        if (gait === gaits.length) {
          gait = 0;
        }
        blink(gait+1);
      };
    };

    if (frame.hands.length === 2) {
      if (phoenix.state !== "pinch" && phoenix.state !== "pinchers") setState('pinch');
      if (phoenix.state === "pinchers") {
        phoenix.r1c.to(fmap(frame.hands[0].indexFinger.medial.basis[2][0], 0.6, -0.3, 19, 60));
        phoenix.l1c.to(fmap(frame.hands[1].indexFinger.medial.basis[2][0], 0.6, -0.3, 60, 19));
        phoenix.r1f.to(fmap(frame.hands[0].indexFinger.medial.basis[2][1], 1, -0.45, 90, 165));
        phoenix.l1f.to(fmap(frame.hands[1].indexFinger.medial.basis[2][1], 1, -0.45, 90, 165));
        phoenix.r1t.to(fmap(frame.hands[0].indexFinger.distal.basis[2][1], 0, 1, 10, 170));
        phoenix.l1t.to(fmap(frame.hands[1].indexFinger.distal.basis[2][1], 0, 1, 10, 170));
      }
    };

    if (frame.hands.length < 2 && phoenix.state === "pinchers") {
      phoenix.l1c.to(h.f.c[1]);
      phoenix.r1c.to(h.f.c[1]);
      phoenix.l1f.to(h.f.f[1]);
      phoenix.r1f.to(h.f.f[1]);
      phoenix.l1t.to(h.f.t[1]);
      phoenix.r1t.to(h.f.t[1]);
      phoenix.att();
    }

    if (frame.hands.length === 1) {

      if (frame.hands[0].grabStrength > .6) {
        setState("sleep");
      } else {
        if (frame.hands[0].palmPosition[2] > -80 && frame.hands[0].palmPosition[2] < 80) {
          if (frame.hands[0].direction[0] < -0.4) {
            setState('left');
          }
          if (frame.hands[0].direction[0] > 0.4) {
            setState('right');
          }
          if (frame.hands[0].direction[0] < 0.4 && frame.hands[0].direction[0] > -0.4) {
            if (phoenix.state === "sleep") {
              setState('stand');
            } else {
              setState('stop');
            }
          }
        } else {
          if (frame.hands[0].palmPosition[2] > 80) {
            setState('reverse');
          }
          if (frame.hands[0].palmPosition[2] < -80) {
            setState('forward');
          }
        }
      };


    //  console.log(frame.hands[0].direction);
    }

    if (frame.hands.length === 0 && phoenix.state !== "stand" && phoenix.state !== "sleep") {
      setState('stop');
    }
    //console.log("Frame: " + frame.hands.length);
  });

  phoenix.go(l);
  //controller.connect();

});
