var five = require("johnny-five"),
  Barcli = require("barcli"),
  StateMachine = require("javascript-state-machine"),
  Leap = require("leapjs"),
  Tharp = require("tharp");

var phoenix, lastGesture, centered = true, locked = false;

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
    chainType: "CoxaY-FemurZ-TibiaZ",
    origin: [4.25, 2.875, 8.15],
    segments: { femur: 7.6125, tibia: 10.4 },
    startAt: [11.25, 0, 12.15],
    constructor: five.Servos,
    actuators: [
      {pin:40, offset: 24, startAt: 0, range: [0, 90] },
      {pin:39, offset: 87, startAt: 78, range: [-80, 78] },
      {pin:38, offset: 165, invert: true, startAt: -140, range: [-160, -10] }
    ]
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
    startAt: [-11.25, 0, 12.15]
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
    startAt: [14.25, 0, 0.1]
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
    startAt: [ -14.25, 0, 0.1 ]
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
    startAt: [ 11.25, 0, -12 ]
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
    startAt: [ -11.25, 0, -12 ]
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
      { name: "sleep", from: ["awake", "walking"], to: "asleep"},
      { name: "point", from: ["awake"], to: "pointing"},
      { name: "unpoint", from: ["pointing"], to: "awake"},
      { name: "wave", from: ["awake", "walking"], to: "waving"},
      { name: "stop", from: ["waving", "walking"], to: "awake"}
    ],
    callbacks: {
      onbeforeevent: function( event, from, to) { stateMeter.update(event); },
      onafterevent: function( event, from, to) { stateMeter.update(to); },
      onbeforewake: function() { phoenix.animation.enqueue(stand); },
      onleaveawake: function() { return StateMachine.ASYNC; },
      onbeforesleep: function() {
        phoenix.offset = [0, 0, 0];
        phoenix.orientation = {
          pitch: 0,
          roll: 0,
          yaw: 0
        };
        phoenix.animation.enqueue(sleep);
      },
      onleaveasleep: function() { return StateMachine.ASYNC; },
      onbeforepoint: function() {
        phoenix.offset = [0, 0, 0];
        phoenix.orientation = {
          pitch: 0,
          roll: 0,
          yaw: 0
        };
        phoenix.animation.enqueue(point);
      },
      onleavepointing: function() { console.log("A");return StateMachine.ASYNC; },
      onbeforeunpoint: function() {
        phoenix.animation.enqueue(unpoint);
      }
    }
  });

  var bootyShake = function(hand) {

    var x = fmap(hand.palmPosition[0], -100, 100, -4, 4);
    var y = fmap(hand.palmPosition[1], 50, 400, -2, 5.5);
    var z = fmap(hand.palmPosition[2]*-1, -50, 50, -4, 1.5);
    phoenix.height = y;

    if (centered) {
      phoenix.offset = [0, 0, 0];
      phoenix.orientation = {
        pitch: 0,
        roll: 0,
        yaw: 0
      };
    } else {

      phoenix.offset = [x, y, z];

      phoenix.orientation.pitch = fmap(hand.pitch(), -0.5, 0.5, -0.50, 0.5);
      phoenix.orientation.roll = fmap(hand.roll() * -1, -0.75, 0.75, -0.35, 0.35);
      phoenix.orientation.yaw = fmap(hand.yaw(), -0.5, 0.5, -0.3, 0.3) * -1;
    }

    if (Math.sqrt(x*x + z*z) > 3) {
      //console.log("WALKING", new Date());// We should be walking
    }

    xMeter.update(x);
    yMeter.update(y);
    zMeter.update(z);

    yawMeter.update(phoenix.orientation.yaw);
    rollMeter.update(phoenix.orientation.roll);
    pitchMeter.update(phoenix.orientation.pitch);

    locked = true;

  };

  phoenix.animation = new five.Animation(phoenix);

  // To stand from sleep
  var stand = {
    duration: 500,
    cuePoints: [0, 0.4, 0.6, 1.0],
    easing: "inQuad",
    oncomplete: function() { centered = false; phoenix.state.transition(); },
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
    duration: 1000,
    cuePoints: [0, 0.2, 0.8, 1.0],
    easing: "outQuad",
    oncomplete: function() { phoenix.state.transition(); },
    keyFrames: [
      [ null, { position: [false, -2, false] }, { position: [false, 1, false] }, { position: [12, 1, 8.25] } ],
      [ null, { position: [false, -2, false] }, { position: [false, 1, false] }, { position: [-12, 1, 8.25] } ],
      [ null, { position: [false, -2, false] }, { position: [false, 1, false] }, { position: [13, 1, 0] } ],
      [ null, { position: [false, -2, false] }, { position: [false, 1, false] }, { position: [-13, 1, 0] } ],
      [ null, { position: [false, -2, false] }, { position: [false, 1, false] }, { position: [12, 1, -8.25] } ],
      [ null, { position: [false, -2, false] }, { position: [false, 1, false] }, { position: [-12, 1, -8.25] } ]
    ]
  };

  // To point
  var point = {
    duration: 500,
    cuePoints: [0, 0.25, 0.625, 1.0],
    easing: "outQuad",
    oncomplete: function() { locked = false;phoenix.state.transition(); },
    keyFrames: [
      [ null, false, false, { position: [13, -3, 12.25] } ],
      [ null, false, false, { position: [-13, -3, 12.25] } ],
      [ null, { position: [15, 3, 0] }, { position: [15, -3, 0] },  { position: [15, -3, 0] } ],
      [ null, { position: [-15, 3, 0] },{ position: [-15, -3, 0] }, { position: [-15, -3, 0] } ],
      [ null, false, false, { position: [13, -3, -12.25] } ],
      [ null, false, false, { position: [-13, -3, -12.25] } ]
    ]
  };

  var unpoint = {
    duration: 1000,
    cuePoints: [0, 0.7, 0.85, 1.0],
    easing: "outQuad",
    oncomplete: function() { locked = false;phoenix.state.transition(); },
    keyFrames: [
      [ null, { position: [13, -3, 12.25] }, { position: [13, -3, 12.25] }, null],
      [ null, false, { position: [-13, -3, 12.25] }, null],
      [ null, false, { position: [15, 3, 2] }, { position: [15, -3, 0] }],
      [ null, false, { position: [-15, 3, 2] }, { position: [-15, -3, 0] }],
      [ null, false, { position: [13, -3, -12.25] }, null],
      [ null, false, { position: [-13, -3, -12.25] }, null]
    ]
  };

  // To walk
  var walk = {
    duraion: 500,
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

  this.repl.inject({
    p: phoenix.state
  });

  Leap.loop({enableGestures: false}, function(frame) {

    if (phoenix.height < -0.1 && phoenix.orientation.pitch > 0.4) {
      if (phoenix.state.can("point") ) {
        locked = true;
        phoenix.state.point();
      }
    }

    if (phoenix.state.current === "pointing" && !locked && frame.hands.length > 0) {
      if (frame.hands[0].grabStrength > 0.9) {

        if (phoenix.state.can("unpoint")) {
          locked = true;
          phoenix.state.unpoint();
        }
      } else {
        var right = frame.hands[0].indexFinger.tipPosition;

        bootyShake(frame.hands[0]);
        rightMeter.update(right[0]);

        locked = true;
        phoenix["@@render"](
          [
            [
              fmap(right[0], 50, 80, 8, 19 ),
              fmap(right[1], 55, 330, 0, 19),
              fmap(right[2], -10, -130, 15, 22)
            ]
          ]
        );

        GLOBAL.setTimeout(function() {locked = false;}, 20);
      }
    }

    if (frame.hands.length === 1 && !locked) {

      if (frame.hands[0].grabStrength > 0.9) {

        if (phoenix.state.can("sleep")) {
          phoenix.state.sleep();
        }

        if (phoenix.state.can("unpoint")) {
          phoenix.state.unpoint();
        }

      } else if (frame.hands[0].grabStrength < 0.9) {

        if (phoenix.state.can("wake")) {
          phoenix.state.wake();
        }

        if (phoenix.state.can("walk")) {
          //phoenix.state.walk();
        }

        if (phoenix.state.current === "walking" || phoenix.state.current === "awake") {
          bootyShake(frame.hands[0]);
          phoenix["@@render"]();
          GLOBAL.setTimeout(function() {locked = false;}, 20);
        }
      }
    }

  });

});

var yMeter = new Barcli({label: "Height", range: [0, 10], precision: 4});
var xMeter = new Barcli({label: "X Offset", range: [-8, 8], constrain: true, precision: 4 });
var zMeter = new Barcli({label: "Z Offset", range: [-4.5, 4.5], constrain: true, precision: 4 });

var yawMeter = new Barcli({label: "Yaw", range: [-0.25, 0.25], precision: 4});
var rollMeter = new Barcli({label: "Roll", range: [-0.25, 0.25], precision: 4});
var pitchMeter = new Barcli({label: "Pitch", range: [-0.25, 0.25], precision: 4});

var leftMeter = new Barcli({label: "Left xPos", precision: 4});
var rightMeter = new Barcli({label: "Right xPos", precision: 4});

var stateMeter = new Barcli({label: "State"});
