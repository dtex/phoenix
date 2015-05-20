/**
 * This example is used to control a Lynxmotion Phoenix hexapod
 * via an Arduino Mega and DFRobot Mega Sensor Shield along with
 * an Arduino Uno and Sparkfun Joystick Shield
 *
 * Robot
 * http://www.lynxmotion.com/c-117-phoenix.aspx
 * http://arduino.cc/en/Main/ArduinoBoardMegaADK
 * http://www.dfrobot.com/index.php?route=product/product&path=35_124&product_id=560
 *
 * Controller
 * http://arduino.cc/en/Main/ArduinoBoardUno
 * https://www.sparkfun.com/products/9760
 *
 * You will want to update a few things if you are going to use this code:
 * 1. You can tweak your walk with the "lift" and "s" objects.
 * 2. You can trim your servos by changing the offset values on each servo
 * 3. You will need to update the board ports to match your system
 *
 */

 var five = require("johnny-five"),
  Leap = require("leapjs"),
  temporal = require("temporal"),
  board,
  ph = { state: "sleep", pendingState: "sleep", newStateTime: 0 },
  easeIn = "inCirc",
  easeOut = "outCirc",
  easeInOut = "inOutCirc",

  // This object described the "leg lift" used in walking
  lift = { femur: 30, tibia: -20 },

  // By default, the gait length is about 2". Adjusting this value scales the
  // gait and can really help out if your using servos don't have enough
  // torque resulting in a saggy bottomed Phoenix. Note that the femur
  // and tibia positions are optimized for a gait scale of 1.0
  gait = 1,

  // This object contains the home positions of each
  // servo in its forward, mid and rear position for
  // walking.
  s = {
    front: {
      coxa: [66-26*gait, 66, 66+19*gait],
      femur: [100, 94, 65],
      tibia: [115, 93, 40]
    },
    mid: {
      coxa: [68-16*gait, 68, 68+16*gait],
      femur: [92, 93, 86],
      tibia: [95, 96, 82]
    },
    rear: {
      coxa: [59+18*gait, 59, 59-22*gait],
      femur: [80, 92, 100],
      tibia: [70, 100, 113]
    }
  },

  l = {
    c: 90,
    f: 165,
    t: 150
  };

var setState = function(newState) {
  var now = Date.now();
  if (newState !== ph.pendingState) {
      ph.pendingState = newState;
      ph.newStateTime = now + 250;
  }

  if (now > ph.newStateTime && ph.State !== newState && ph.pendingState !== ph.state) {
    console.log(newState);
    switch (newState) {
      case "left":
        if (ph.state !== "left") {
          ph.state = "left";
          ph.preTurn("left");
        }
        break;
      case "right":
        if (ph.state !== "right") {
          ph.state = "right";
          ph.preTurn("right");
        }
        break;
      case "stop":
        if (ph.state === "forward" || ph.state === "reverse" || ph.state === "left" || ph.state === "right" ) {
          ph.state = "stop";
          ph.att();
        }
        break;
      case "reverse":
        if (ph.state !== "reverse") {
          ph.state = "reverse";
          ph.preWalk("rev");
        }
        break;
      case "forward":
        if (ph.state !== "forward") {
          ph.state = "forward";
          ph.preWalk();
        }
        break;
      case "pinchers":
        break;
      case "sleep":
        if (ph.state !== "sleep") {
          ph.sleep();
          return;
        }
        break;
      case "stand":
        if (ph.state === "sleep" || ph.state === "stop") {
          ph.stand();
          return;
        }
    }
    ph.state = newState;
  }
};

var controller = new Leap.Controller();

controller.on("frame", function(frame) {
  if (frame.hands.length === 2) {
    setState('pinchers');
  }
  if (frame.hands.length === 1) {
    if (frame.hands[0].palmPosition[2] > -80 && frame.hands[0].palmPosition[2] < 80) {
      if (frame.hands[0].direction[0] < -0.4) {
        setState('left');
      }
      if (frame.hands[0].direction[0] > 0.4) {
        setState('right');
      }
      if (frame.hands[0].direction[0] < 0.4 && frame.hands[0].direction[0] > -0.4) {
        if (ph.state === "sleep") {
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
  //  console.log(frame.hands[0].direction);
  }

  if (frame.hands.length === 0) {
    setState('sleep');
  }
  //console.log("Frame: " + frame.hands.length);
});

controller.connect();

board = new five.Board().on("ready", function() {

  ph.r1c = new five.Servo({pin:40, offset: 67, startAt: l.c, range: [-1, 88], isInverted: true });
  ph.r1f = new five.Servo({pin:39, offset: -2, startAt:  l.f, range: [69, 177] });
  ph.r1t = new five.Servo({pin:38, offset: 15, startAt: l.t, range: [0, 165] });
  ph.r1 = new five.Servo.Array([ ph.r1c, ph.r1f, ph.r1t ]);

  //Left front leg
  ph.l1c = new five.Servo({pin:27, offset: 59, startAt: l.c, range: [-1, 88] });
  ph.l1f = new five.Servo({pin:26, offset: -13, startAt: l.f, range: [25, 177], isInverted: true });
  ph.l1t = new five.Servo({pin:25, offset: 3, startAt: l.t, range: [0, 165], isInverted: true });
  ph.l1 = new five.Servo.Array([ ph.l1c, ph.l1f, ph.l1t ]);

  //Right mid leg
  ph.r2c = new five.Servo({pin:49, offset: 4, startAt: l.c, range: [50, 109], isInverted: true });
  ph.r2f = new five.Servo({pin:48, offset: -12, startAt: l.f, range: [25, 177] });
  ph.r2t = new five.Servo({pin:47, offset: -7, startAt: l.t, range: [0, 165] });
  ph.r2 = new five.Servo.Array([ ph.r2c, ph.r2f, ph.r2t ]);

  //Left mid leg
  ph.l2c = new five.Servo({pin:23, offset: 6, startAt: l.c, range: [50, 109] });
  ph.l2f = new five.Servo({pin:21, offset: -15, startAt: l.f, range: [25, 177], isInverted: true });
  ph.l2t = new five.Servo({pin:20, offset: -7, startAt: l.t, range: [0, 165], isInverted: true });
  ph.l2 = new five.Servo.Array([ ph.l2c, ph.l2f, ph.l2t ]);

  //Right rear leg
  ph.r3c = new five.Servo({pin:45, offset: 65, startAt: l.c, range: [0, 100]});
  ph.r3f = new five.Servo({pin:44, offset: -10, startAt: l.f, range: [25, 177] });
  ph.r3t = new five.Servo({pin:43, offset: -3, startAt: l.t, range: [0, 165] });
  ph.r3 = new five.Servo.Array([ ph.r3c, ph.r3f, ph.r3t ]);

  //Left rear leg
  ph.l3c = new five.Servo({pin:19, offset: 52, startAt: l.c, range: [0, 100], isInverted: true });
  ph.l3f = new five.Servo({pin:18, offset: -6, startAt: l.f, range: [25, 177], isInverted: true });
  ph.l3t = new five.Servo({pin:17, offset: 0, startAt: l.t, range: [0, 165], isInverted: true });
  ph.l3 = new five.Servo.Array([ ph.l3c, ph.l3f, ph.l3t ]);

  ph.femurs = new five.Servo.Array([ph.r1f, ph.l1f, ph.r2f, ph.l2f, ph.r3f, ph.l3f]);
  ph.tibia = new five.Servo.Array([ph.r1t, ph.l1t, ph.r2t, ph.l2t, ph.r3t, ph.l3t]);
  ph.coxa = new five.Servo.Array([ph.r1c, ph.l1c, ph.r2c, ph.l2c, ph.r3c, ph.l3c]);
  ph.joints = new five.Servo.Array([ph.coxa, ph.femurs, ph.tibia]);

  ph.legs = new five.Servo.Array([ph.r1c, ph.r1f, ph.r1t, ph.l1c, ph.l1f, ph.l1t, ph.r2c, ph.r2f, ph.r2t, ph.l2c, ph.l2f, ph.l2t, ph.r3c, ph.r3f, ph.r3t, ph.l3c, ph.l3f, ph.l3t]);

  var legsAnimation = new five.Animation(ph.legs);

  var sleep = {
    duration: 500,
    cuePoints: [0, 0.5, 1.0],
    fps: 100,
    oncomplete: function() {
      ph.state = "sleep";
    },
    keyFrames: [
      [null, false, { degrees: 45, easing: easeOut }],
      [null, { degrees: 136, easing: easeInOut }, { degrees: 180, easing: easeInOut }],
      [null, { degrees: 120, easing: easeInOut }, { step: 60, easing: easeInOut }],
      [null, false, { degrees: 45, easing: easeOut }],
      [null, { degrees: 136, easing: easeInOut }, { degrees: 180, easing: easeInOut }],
      [null, { degrees: 120, easing: easeInOut }, { step: 60, easing: easeInOut }],
      [null, false, { degrees: 45, easing: easeOut }],
      [null, { degrees: 136, easing: easeInOut }, { degrees: 180, easing: easeInOut }],
      [null, { degrees: 120, easing: easeInOut }, { step: 60, easing: easeInOut }],
      [null, false, { degrees: 45, easing: easeOut }],
      [null, { degrees: 136, easing: easeInOut }, { degrees: 180, easing: easeInOut }],
      [null, { degrees: 120, easing: easeInOut }, { step: 60, easing: easeInOut }],
      [null, false, { degrees: 45, easing: easeOut }],
      [null, { degrees: 136, easing: easeInOut }, { degrees: 180, easing: easeInOut }],
      [null, { degrees: 120, easing: easeInOut }, { step: 60, easing: easeInOut }],
      [null, false, { degrees: 45, easing: easeOut }],
      [null, { degrees: 136, easing: easeInOut }, { degrees: 180, easing: easeInOut }],
      [null, { degrees: 120, easing: easeInOut }, { step: 60, easing: easeInOut }]
    ]
  };

  var waveRight = {
    duration: 1500,
    cuePoints: [0, 0.1, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    oncomplete: function() {
      ph.state = "stand";
    },
    keyFrames: [
      [null, false, { degrees: 120, easing: easeInOut }, false, false, false, false, false, { degrees: 52, easing: easeInOut }, {copyDegrees: 0, easing: easeInOut} ], // r1c
      [null, { step: 55, easing: easeInOut }, false, false, false, false, false, false, { step: -55, easing: easeInOut }, {copyDegrees: 0, easing: easeInOut} ], // r1f
      [null, { degrees: 85, easing: easeInOut }, { degrees: 45, easing: easeInOut }, { step: -15, easing: easeInOut}, { step: 30, easing: easeInOut}, { copyDegrees: 3, easing: easeInOut}, { copyFrame: 4 }, { copyDegrees: 2, easing: easeInOut}, { copyFrame: 1 }, {copyDegrees: 0, easing: easeInOut} ], // r1t
      [null], // 11c
      [null], // l1f
      [null], // l1t
      [null], // r2c
      [null], // r2f
      [null], // r2t
      [null], // 12c
      [null], // l2f
      [null], // l2t
      [null], // r3c
      [null], // r3f
      [null], // r3t
      [null], // l3c
      [null], // l3f
      [null], // l3t
    ]
  };

  var waveLeft = {
    duration: 1500,
    cuePoints: [0, 0.1, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    oncomplete: function() {
      ph.state = "stand";
    },
    keyFrames: [
      [null], // r1c
      [null], // r1f
      [null], // r1t
      [null, false, { degrees: 120, easing: easeInOut }, false, false, false, false, false, { degrees: 52, easing: easeInOut }, {copyDegrees: 0, easing: easeInOut} ], // l1c
      [null, { step: 55, easing: easeInOut }, false, false, false, false, false, false, { step: -55, easing: easeInOut }, {copyDegrees: 0, easing: easeInOut} ], // l1f
      [null, { degrees: 85, easing: easeInOut }, { degrees: 45, easing: easeInOut }, { step: -15, easing: easeInOut}, { step: 30, easing: easeInOut}, { copyDegrees: 3, easing: easeInOut}, { copyFrame: 4 }, { copyDegrees: 2, easing: easeInOut}, { copyFrame: 1 }, {copyDegrees: 0, easing: easeInOut} ], // l1t
      [null], // r2c
      [null], // r2f
      [null], // r2t
      [null], // 12c
      [null], // l2f
      [null], // l2t
      [null], // r3c
      [null], // r3f
      [null], // r3t
      [null], // l3c
      [null], // l3f
      [null], // l3t
    ]
  };

  var stand = {
    duration: 500,
    loop: false,
    fps: 100,
    cuePoints: [0, 0.1, 0.3, 0.7, 1.0],
    oncomplete: function() {
      ph.state = "stand";
    },
    keyFrames: [
      [null, { degrees: s.front.coxa[1] }],
      [null, false, false, { degrees: s.front.femur[1] + 26, easing: easeOut}, { degrees: s.front.femur[1], easing: easeIn}],
      [null, false, { degrees: s.front.tibia[1] + 13}, false, { degrees: s.front.tibia[1] }],

      [null, { degrees: s.front.coxa[1] }],
      [null, false, false, { degrees: s.front.femur[1] + 26, easing: easeOut}, { degrees: s.front.femur[1], easing: easeIn}],
      [null, false, { degrees: s.front.tibia[1] + 13}, false, { degrees: s.front.tibia[1] }],

      [null, { degrees: s.mid.coxa[1] }],
      [null, false, false, { degrees: s.mid.femur[1] + 26, easing: easeOut}, { degrees: s.mid.femur[1], easing: easeIn}],
      [null, false, { degrees: s.mid.tibia[1] + 13}, false, { degrees: s.mid.tibia[1] }],

      [null, { degrees: s.mid.coxa[1] }],
      [null, false, false, { degrees: s.mid.femur[1] + 26, easing: easeOut}, { degrees: s.mid.femur[1], easing: easeIn}],
      [null, false, { degrees: s.mid.tibia[1] + 13}, false, { degrees: s.mid.tibia[1] }],

      [null, { degrees: s.rear.coxa[1] }],
      [null, false, false, { degrees: s.rear.femur[1] + 26, easing: easeOut}, { degrees: s.rear.femur[1], easing: easeIn}],
      [null, false, { degrees: s.rear.tibia[1] + 13}, false, { degrees: s.rear.tibia[1] }],

      [null, { degrees: s.rear.coxa[1] }],
      [null, false, false, { degrees: s.rear.femur[1] + 26, easing: easeOut}, { degrees: s.rear.femur[1], easing: easeIn}],
      [null, false, { degrees: s.rear.tibia[1] + 13}, false, { degrees: s.rear.tibia[1] }]
    ]
  };

  var easingDemoReady = {
    duration: 100,
    cuePoints: [0, 1],
    oncomplete: function() {
      ph.state = "easingDemoReady";
    },
    keyFrames: [
      [null, {degrees: 90}], //r1c
      [null, {degrees: 10}], //r1f
      [null, {degrees: 90}], //r1t

      [null, {degrees: 40}], //l1c
      [null, {degrees: 40}], //l1f
      [null, {degrees: 60}], //l1t

      [null, {degrees: 60}], //r2c
      [null, {degrees: 25}], //r2f
      [null, {degrees: 30}], //r2t

      [null, {degrees: 70}], //l2c
      [null, {degrees: 180}], //l2f
      [null, {degrees: 90}],

      [null, {degrees: 90}],
      [null, {degrees: 10}], //r3f
      [null, {degrees: 90}],

      [null, {degrees: 40}], //l3c
      [null, {degrees: 40}],
      [null, {degrees: 60}]

    ]
  };

  var easingDemoLinear = {
    duration: 2000,
    cuePoints: [0, 0.5, 1],
    onstart: function() {
      ph.state = "easingDemoLinear";
    },
    loop: true,
    keyFrames: [
      [ null ],
      [ null ],
      [ null ],

      [ null ],
      [ null ],
      [ null ],

      [ null ],
      [{degrees: 25, easing: "linear" }, {degrees: 170, easing: "linear"}, {degrees: 25, easing: "linear" }], //r2f
      [ null ],

      [ null ],
      [ null ],
      [ null ],

      [ null ],
      [ null ],
      [ null ],

      [ null ],
      [ null ],
      [ null ]

    ]
  };

  var easingDemoCirc = {
    duration: 2000,
    cuePoints: [0, 0.5, 1],
    loop: true,
    onstart: function() {
      ph.state = "easingDemoCirc";
    },
    keyFrames: [
      [ null ],
      [ null ],
      [ null ],

      [ null ],
      [ null ],
      [ null ],

      [ null ],
      [{degrees: 25, easing: "inOutCirc" }, {degrees: 170, easing: "inOutCirc"}, {degrees: 25, easing: "inOutCirc" }], //r2f
      [ null ],

      [ null ],
      [ null ],
      [ null ],

      [ null ],
      [ null ],
      [ null ],

      [ null ],
      [ null ],
      [ null ]

    ]
  };

  ph.att = function() {
    var i, ani, work = [
      { name: "r1", offset: 0, home: s.front.femur[1], thome: s.front.tibia[1], chome: s.front.coxa[1]},
      { name: "r2", offset: 0, home: s.mid.femur[1], thome: s.mid.tibia[1], chome: s.front.coxa[1] },
      { name: "r3", offset: 0, home: s.rear.femur[1], thome: s.rear.tibia[1], chome: s.front.coxa[1] },
      { name: "l1", offset: 0, home: s.front.femur[1], thome: s.front.tibia[1], chome: s.front.coxa[1] },
      { name: "l2", offset: 0, home: s.mid.femur[1], thome: s.mid.tibia[1], chome: s.front.coxa[1] },
      { name: "l3", offset: 0, home: s.rear.femur[1], thome: s.rear.tibia[1], chome: s.front.coxa[1] }
    ];
    work.forEach(function(leg, i) {
      work[i].offset = Math.abs(ph[leg.name+"f"].last.reqDegrees - leg.home);
    });
    work.sort(function(a,b) {
      return a.offset < b.offset;
    });
    work.forEach(function(leg, i) {
      temporal.queue([
        {
          delay: 150*i,
          task: function() {
            ph[leg.name+"f"].to(leg.home + lift.femur);
            ph[leg.name+"t"].to(leg.thome + lift.tibia);
          }
        },
        {
          delay: 50,
          task: function() {
            ph[leg.name+"c"].to(leg.chome);
          }
        },
        {
          delay: 50,
          task: function() {
            ph[leg.name+"f"].to(leg.home);
            ph[leg.name+"t"].to(leg.thome);
          }
        }
      ]);
    });
    ph.state = "stand";
  };

  ph.sleep = function() {
    legsAnimation.enqueue(sleep);
  };

  ph.waveLeft = function() {
    legsAnimation.enqueue(waveLeft);
  };

  ph.waveRight = function() {
    legsAnimation.enqueue(waveRight);
  };

  ph.stand = function() {
    legsAnimation.enqueue(stand);
  };

  ph.easingDemoReady = function() {
    legsAnimation.enqueue(easingDemoReady);
  };

  ph.easingDemoLinear = function() {
    legsAnimation.enqueue(easingDemoLinear);
  };

  ph.easingDemoCirc = function() {
    legsAnimation.enqueue(easingDemoCirc);
  };

  ph.preWalk = function(dir) {
    var a, b;
    if (dir === "rev") {
      a = 0;
      b = 2;
    } else {
      a = 2;
      b = 0;
    }
    legsAnimation.enqueue({
      duration: 300,
      cuePoints: [0, 0.5, 1.0],
      loop: false,
      oncomplete: function() { ph.walk(dir); },
      keyFrames: [
        [ null, null, {degrees: s.front.coxa[a]}], //r1c
        [ null, { step: lift.femur, easing: easeOut }, {degrees: s.front.femur[a], easing: easeIn}], //r1f
        [ null, { step: lift.tibia, easing: easeOut }, {degrees: s.front.tibia[a], easing: easeIn}], //r1t

        [ null, null, {degrees: s.front.coxa[b]}], //l1c
        [ null, null, {degrees: s.front.femur[b]}], //l1f
        [ null, null, {degrees: s.front.tibia[b]}], //l1t

        [ null, null, {degrees: s.mid.coxa[b]}], //r2c
        [ null, null, {degrees: s.mid.femur[b]}], //r2f
        [ null, null, {degrees: s.mid.tibia[b]}], //r2t

        [ null, null, {degrees: s.mid.coxa[a]}], //l2c
        [ null, { step: lift.femur, easing: easeOut }, {degrees: s.mid.femur[a], easing: easeIn}], //l2f
        [ null, { step: lift.tibia, easing: easeOut }, {degrees: s.mid.tibia[a], easing: easeIn}], //l2t

        [ null, null, {degrees: s.rear.coxa[a]}], //r3c
        [ null, { step: lift.femur, easing: easeOut },  {degrees: s.rear.femur[a], easing: easeIn}], //r3f
        [ null, { step: lift.tibia, easing: easeOut }, {degrees: s.rear.tibia[a], easing: easeIn}], //r3t

        [ null, null, {degrees: s.rear.coxa[b]}], //l3c
        [ null, null, {degrees: s.rear.femur[b]}], //l3f
        [ null, null, {degrees: s.rear.tibia[b]}] //l3t
      ]
    });
    return this;
  };

  ph.walk = function(dir) {
    var a, b;
    if (dir === "rev") {
      a = 0;
      b = 2;
    } else {
      a = 2;
      b = 0;
    }

    legsAnimation.enqueue({
      duration: 600,
      cuePoints: [0, 0.25, 0.5, 0.75, 1.0],
      loop: true,
      fps: 100,
      onstop: function() { ph.att(); },
      oncomplete: function() { },
      keyFrames: [
        [ null, {degrees: s.front.coxa[1]}, {degrees: s.front.coxa[b]}, null, {degrees: s.front.coxa[a]}],
        [ null, {degrees: s.front.femur[1]}, {degrees: s.front.femur[b]}, { step: lift.femur, easing: easeOut }, {degrees: s.front.femur[a], easing: easeIn}],
        [ null, {degrees: s.front.tibia[1]}, {degrees: s.front.tibia[b]}, { step: lift.tibia, easing: easeOut }, {degrees: s.front.tibia[a], easing: easeIn}],

        [ null, null, {degrees: s.front.coxa[a]}, {degrees: s.front.coxa[1]}, {degrees: s.front.coxa[b]}],
        [ null, { step: lift.femur, easing: easeOut }, {degrees: s.front.femur[a], easing: easeIn}, {degrees: s.front.femur[1]}, {degrees: s.front.femur[b]}],
        [ null, { step: lift.tibia, easing: easeOut }, {degrees: s.front.tibia[a], easing: easeIn}, {degrees: s.front.tibia[1]}, {degrees: s.front.tibia[b]}],

        [ null, null, {degrees: s.mid.coxa[a]}, {degrees: s.mid.coxa[1]}, {degrees: s.mid.coxa[b]}],
        [ null, { step: lift.femur, easing: easeOut }, {degrees: s.mid.femur[a], easing: easeIn}, {degrees: s.mid.femur[1]}, {degrees: s.mid.femur[b]}],
        [ null, { step: lift.tibia, easing: easeOut }, {degrees: s.mid.tibia[a], easing: easeIn}, {degrees: s.mid.tibia[1]}, {degrees: s.mid.tibia[b]}],

        [ null, {degrees: s.mid.coxa[1]}, {degrees: s.mid.coxa[b]}, null, {degrees: s.mid.coxa[a]}],
        [ null, {degrees: s.mid.femur[1]}, {degrees: s.mid.femur[b]}, { step: lift.femur, easing: easeOut }, {degrees: s.mid.femur[a], easing: easeIn}],
        [ null, {degrees: s.mid.tibia[1]}, {degrees: s.mid.tibia[b]}, { step: lift.tibia, easing: easeOut }, {degrees: s.mid.tibia[a], easing: easeIn}],

        [ null, {degrees: s.rear.coxa[1]}, {degrees: s.rear.coxa[b]}, null, {degrees: s.rear.coxa[a]}],
        [ null, {degrees: s.rear.femur[1]}, {degrees: s.rear.femur[b]}, { step: lift.femur, easing: easeOut }, {degrees: s.rear.femur[a], easing: easeIn}],
        [ null, {degrees: s.rear.tibia[1]}, {degrees: s.rear.tibia[b]}, { step: lift.tibia, easing: easeOut }, {degrees: s.rear.tibia[a], easing: easeIn}],

        [ null, null, {degrees: s.rear.coxa[a]}, {degrees: s.rear.coxa[1]}, {degrees: s.rear.coxa[b]}],
        [ null, { step: lift.femur, easing: easeOut }, {degrees: s.rear.femur[a], easing: easeIn}, {degrees: s.rear.femur[1]}, {degrees: s.rear.femur[b]}],
        [ null, { step: lift.tibia, easing: easeOut }, {degrees: s.rear.tibia[a], easing: easeIn}, {degrees: s.rear.tibia[1]}, {degrees: s.rear.tibia[b]}],
      ]
    });
    return this;
  };

  ph.preTurn = function(dir) {
    var a, b;
    if (dir === "left") {
      a = 0;
      b = 2;
    } else {
      a = 2;
      b = 0;
    }
    legsAnimation.enqueue({
      duration: 300,
      cuePoints: [0, 0.5, 1.0],
      oncomplete: function() { ph.turn(dir); },
      onstop: function() { ph.att(); },
      keyFrames: [
        [ null, null, {degrees: s.front.coxa[a]}],
        [ null, null, {degrees: s.front.femur[a]}],
        [ null, null, {degrees: s.front.tibia[a]}],

        [ null, null, {degrees: s.front.coxa[a]}],
        [ null, { step: lift.femur, easing: easeOut }, {degrees: s.front.femur[a], easing: easeIn}],
        [ null, { step: lift.tibia, easing: easeOut }, {degrees: s.front.tibia[a], easing: easeIn}],

        [ null, null, {degrees: s.mid.coxa[b]}],
        [ null, { step: lift.femur, easing: easeOut }, {degrees: s.mid.femur[b], easing: easeIn}],
        [ null, { step: lift.tibia, easing: easeOut }, {degrees: s.mid.tibia[b], easing: easeIn}],

        [ null, null, {degrees: s.mid.coxa[b]}],
        [ null, null, {degrees: s.mid.femur[b]}],
        [ null, null, {degrees: s.mid.tibia[b]}],

        [ null, null, {degrees: s.rear.coxa[a]}],
        [ null, null, {degrees: s.rear.femur[a]}],
        [ null, null, {degrees: s.rear.tibia[a]}],

        [ null, null, {degrees: s.rear.coxa[a]}],
        [ null, { step: lift.femur, easing: easeOut }, {degrees: s.rear.femur[a], easing: easeIn}],
        [ null, { step: lift.tibia, easing: easeOut }, {degrees: s.rear.tibia[a], easing: easeIn}],
      ]
    });
    return this;
  };

  ph.stop = function() {
    ph.animation.stop();
  };

  ph.turn = function(dir) {
    var a, b;
    if (dir === "left") {
      a = 0;
      b = 2;
    } else {
      a = 2;
      b = 0;
    }
    legsAnimation.enqueue({
      duration: 600,
      fps: 100,
      cuePoints: [0, 0.25, 0.5, 0.75, 1.0],
      loop: true,
      onstop: function() { ph.att(); },
      keyFrames: [
        [ null, null, {degrees: s.front.coxa[b]}, null, {degrees: s.front.coxa[a]}],
        [ null, { step: lift.femur, easing: easeOut }, {degrees: s.front.femur[b]}, null, {degrees: s.front.femur[a]}],
        [ null, { step: lift.tibia, easing: easeOut }, {degrees: s.front.tibia[b]}, null, {degrees: s.front.tibia[a]}],

        [ null, null, {degrees: s.front.coxa[b]}, null, {degrees: s.front.coxa[a]}],
        [ null, null, {degrees: s.front.femur[b], easing: easeIn}, { step: lift.femur, easing: easeOut }, {degrees: s.front.femur[a], easing: easeIn}],
        [ null, null, {degrees: s.front.tibia[b], easing: easeIn}, { step: lift.tibia, easing: easeOut }, {degrees: s.front.tibia[a], easing: easeIn}],

        [ null, null, {degrees: s.mid.coxa[a]}, null, {degrees: s.mid.coxa[b]}],
        [ null, null, {degrees: s.mid.femur[a], easing: easeIn}, { step: lift.femur, easing: easeOut }, {degrees: s.mid.femur[b], easing: easeIn}],
        [ null, null, {degrees: s.mid.tibia[a], easing: easeIn}, { step: lift.tibia, easing: easeOut }, {degrees: s.mid.tibia[b], easing: easeIn}],

        [ null, null, {degrees: s.mid.coxa[a]}, null, {degrees: s.mid.coxa[b]}],
        [ null, { step: lift.femur, easing: easeOut }, {degrees: s.mid.femur[a]}, null, {degrees: s.mid.femur[b]}],
        [ null, { step: lift.tibia, easing: easeOut }, {degrees: s.mid.tibia[a]}, null, {degrees: s.mid.tibia[b]}],

        [ null, null, {degrees: s.rear.coxa[b]}, null, {degrees: s.rear.coxa[a]}],
        [ null, { step: lift.femur, easing: easeOut }, {degrees: s.rear.femur[b]}, null, {degrees: s.rear.femur[a]}],
        [ null, { step: lift.tibia, easing: easeOut }, {degrees: s.rear.tibia[b]}, null, {degrees: s.rear.tibia[a]}],

        [ null, null, {degrees: s.rear.coxa[b]}, null, {degrees: s.rear.coxa[a]}],
        [ null, null, {degrees: s.rear.femur[b], easing: easeIn}, { step: lift.femur, easing: easeOut }, {degrees: s.rear.femur[a], easing: easeIn}],
        [ null, null, {degrees: s.rear.tibia[b], easing: easeIn}, { step: lift.tibia, easing: easeOut }, {degrees: s.rear.tibia[a], easing: easeIn}]
      ]
    });

    return this;

  };

  // Inject the `servo` hardware into;
  // the Repl instance's context;
  // allows direct command line access
  this.repl.inject({
     ph: ph
  });

});
