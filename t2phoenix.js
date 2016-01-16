var five = require("johnny-five"),
  StateMachine = require("javascript-state-machine"),
  Tharp = require("tharp"),
  Tessel = require("tessel-io");

var phoenix, lastGesture, centered = true, locked = false;

var fmap = function(value, fromLow, fromHigh, toLow, toHigh) {
  return constrain((value - fromLow) * (toHigh - toLow) /
    (fromHigh - fromLow) + toLow, toLow, toHigh);
};

var constrain = function(value, lower, upper) {
  return Math.min(upper, Math.max(lower, value));
};

var board = new five.Board({io: new Tessel()}).on("ready", function() {

  // Right front leg
  var r1 = new Tharp.Chain({
    chainType: "CoxaY-FemurZ-TibiaZ",
    origin: [4.25, 2.875, 8.15],
    links: { femur: 7.6125, tibia: 10.4 },
    startAt: [11.25, 0, 12.15],
    constructor: five.Servos,
    actuators: [
      {port: "A", address: 0x73, controller: "PCA9685", pin:0, offset: 24, startAt: 0, range: [0, 90] },
      {port: "A", address: 0x73, controller: "PCA9685", pin:2, offset: 87, startAt: 78, range: [-80, 78] },
      {port: "A", address: 0x73, controller: "PCA9685", pin:3, offset: 165, invert: true, startAt: -140, range: [-160, -10] }
    ]
  });

  // Left front leg
  var l1 = new Tharp.Chain({
    constructor: five.Servos,
    actuators: [
      {port: "B", address: 0x74, controller: "PCA9685", pin:1, offset: -31, startAt: 149, range: [90, 180] },
      {port: "B", address: 0x74, controller: "PCA9685", pin:2, offset: -77, startAt: 102, range: [110, 260] },
      {port: "B", address: 0x74, controller: "PCA9685", pin:3, offset: -176, invert: true, startAt: 320, range: [180, 340] }
    ],
    chainType: "CoxaY-FemurZ-TibiaZ",
    origin: [-4.25, 2.875, 8.15],
    links: { femur: 7.6125, tibia: 10.4 },
    startAt: [-11.25, 0, 12.15]
  });

  // Right mid leg
  var r2 = new Tharp.Chain({
    constructor: five.Servos,
    actuators: [
      {port: "A", address: 0x73, controller: "PCA9685", pin:4, offset: 86, startAt: 0, range: [-60, 60] },
      {port: "A", address: 0x73, controller: "PCA9685", pin:5, offset: 78, startAt: 78, range: [-80, 78] },
      {port: "A", address: 0x73, controller: "PCA9685", pin:6, offset: 187, invert: true, startAt: -140, range: [-160, -10] }
    ],
    chainType: "CoxaY-FemurZ-TibiaZ",
    origin: [6.25, 2.875, 0],
    links: { femur: 7.6125, tibia: 10.4 },
    startAt: [14.25, 0, 0.1]
  });

  // Left mid leg
  var l2 = new Tharp.Chain({
    constructor: five.Servos,
    actuators: [
      {port: "B", address: 0x74, controller: "PCA9685", pin:4, offset: -84, startAt: 180, range: [120, 240] },
      {port: "B", address: 0x74, controller: "PCA9685", pin:5, offset: -76, startAt: 102, range: [100, 260] },
      {port: "B", address: 0x74, controller: "PCA9685", pin:6, offset: -185, invert: true, startAt: 320, range: [180, 340] }
    ],
    chainType: "CoxaY-FemurZ-TibiaZ",
    origin: [-6.25, 2.875,  0],
    links: { femur: 7.6125, tibia: 10.4 },
    startAt: [ -14.25, 0, 0.1 ]
  });

  // Right rear leg
  var r3 = new Tharp.Chain({
    constructor: five.Servos,
    actuators: [
      {port: "A", address: 0x73, controller: "PCA9685", pin:7, offset: 155, startAt: 0, range: [-90, 0] },
      {port: "A", address: 0x73, controller: "PCA9685", pin:8, offset: 79, startAt: 78, range: [-80, 78] },
      {port: "A", address: 0x73, controller: "PCA9685", pin:9, offset: 185, invert: true, startAt: -140, range: [-160, -10] }
    ],
    chainType: "CoxaY-FemurZ-TibiaZ",
    origin: [4.25, 2.875, -8.15],
    links: { femur: 7.6125, tibia: 10.4 },
    startAt: [ 11.25, 0, -12 ]
  });

  // Left rear leg
  var l3 = new Tharp.Chain({
    constructor: five.Servos,
    actuators: [
      {port: "B", address: 0x74, controller: "PCA9685", pin:7, offset: -141, startAt: 180, range: [161, 235] },
      {port: "B", address: 0x74, controller: "PCA9685", pin:8, offset: -83, startAt: 102, range: [110, 260] },
      {port: "B", address: 0x74, controller: "PCA9685", pin:9, offset: -182, invert: true, startAt: 320, range: [180, 340] }
    ],
    chainType: "CoxaY-FemurZ-TibiaZ",
    origin: [-4.25, 2.875, -8.15],
    links: { femur: 7.6125, tibia: 10.4 },
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
      onbeforeevent: function( event, from, to) { console.log(event); },
      onafterevent: function( event, from, to) { console.log(to); },
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

    var x = fmap(hand.palmPosition[0], -100, 100, -3, 3);
    var y = fmap(hand.palmPosition[1], 50, 400, -1, 4.5);
    var z = fmap(hand.palmPosition[2]*-1, -50, 50, -3, 0.5);

    if (centered) {
      phoenix.offset = [0, 0, 0];
      phoenix.orientation = {
        pitch: 0,
        roll: 0,
        yaw: 0
      };
    } else {

      phoenix.offset = [x, y, z];

      phoenix.orientation.pitch = fmap(hand.pitch(), -0.5, 0.5, -0.40, 0.4);
      phoenix.orientation.roll = fmap(hand.roll() * -1, -0.75, 0.75, -0.25, 0.25);
      phoenix.orientation.yaw = fmap(hand.yaw(), -0.5, 0.5, -0.2, 0.2) * -1;
    }

    if (Math.sqrt(x*x + z*z) > 3) {
      //console.log("WALKING", new Date());// We should be walking
    }

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
    duration: 500,
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
      [ null, false, false, { position: [13, -5, 12.25] } ],
      [ null, false, false, { position: [-13, -5, 12.25] } ],
      [ null, { position: [15, 3, 2] }, { position: [15, -3, 3] },  { position: [15, -3.5, 4] } ],
      [ null, { position: [-15, 3, 2] },{ position: [-15, -3, 3] }, { position: [-15, -3.5, 4] } ],
      [ null, false, false, { position: [13, -1, -12.25] } ],
      [ null, false, false, { position: [-13, -1, -12.25] } ]
    ]
  };

  var unpoint = {
    duration: 750,
    cuePoints: [0, 0.5, 0.75, 1.0],
    easing: "outQuad",
    oncomplete: function() { locked = false;phoenix.state.transition(); },
    keyFrames: [
      [ null, { position: [13, -5, 12.25] }, { position: [13, -3, 12.25] }, null],
      [ null, { position: [-13, -5, 12.25] }, { position: [-13, -3, 12.25] }, null],
      [ null, false, { position: [15, 2, 2] }, { position: [15, -3, 0] }],
      [ null, false, { position: [-15, 2, 2] }, { position: [-15, -3, 0] }],
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

  phoenix.state.wake();

  this.repl.inject({
    p: phoenix.state
  });

});
