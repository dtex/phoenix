var five = require("johnny-five"),
  keypress = require("keypress"),
  Barcli = require("barcli"),
  StateMachine = require("javascript-state-machine"),
  vector = require("vektor").vector,
  rotate = require("vektor").rotate,
  matrix = require("vektor").matrix,
  Leap = require("leapjs"),
  phUtils = require("./phoenixUtils.js");

var phoenix = {
  state: StateMachine.create({
    initial: "asleep",
    events: [
      { name: "wake", from: "asleep", to: "awake"},
      { name: "walk", from: "awake", to: "walking"},
      { name: "sleep", from: "awake", to: "sleep"},
      { name: "pinch", from: "awake", to: "pinching"},
      { name: "wave", from: "awake", to: "waving"},
      { name: "stop", from: ["pinching", "waving", "walking"], to: "awake"}
    ]
  }),
  bones: { FEMUR: 7.6125, TIBIA: 10.4 },
  positions: {
    sleep: [
      [17.25, 5, 8.15],
      [-17.25, 5, 8.15],
      [17.25, 5, 0.1],
      [-17.25, 5, 0.1],
      [17.25, 5, -8],
      [-17.25, 5, -8]
    ]
  },
  roll: 0,
  pitch: 0,
  yaw: 0
};

phoenix.bones.FEMSQ = Math.pow(phoenix.bones.FEMUR, 2);
phoenix.bones.TIBSQ = Math.pow(phoenix.bones.TIBIA, 2);
phoenix.bones.TIBFEMx2 = 2 * phoenix.bones.TIBIA * phoenix.bones.FEMUR;

var legsRender = function( position, progress ) {
  for (i = 0; i < this.length; i++) {
    this[String(i)][five.Animation.render]( position[i], progress );
  }
};

var whiles = 0;
var legRender = function( position, progress ) {
  var leg = this;
  var pos = position;
  var invalid = false;
  var posMatrix = new matrix(1,3);
  posMatrix.m = pos;

  var posVector = new vector(pos);
  var rotationMatrix = new rotate.RotZ(phoenix.roll);
  posVector = rotationMatrix.dot(posVector);
  rotationMatrix = new rotate.RotX(phoenix.pitch);
  posVector = rotationMatrix.dot(posVector);
  rotationMatrix = new rotate.RotY(phoenix.yaw);
  posVector = rotationMatrix.dot(posVector);
  pos = posVector.v;

  pos = [pos[0] - leg.origin[0], pos[1] - leg.origin[1], pos[2] - leg.origin[2]];

  var coxaAngle = Math.atan(pos[2]/pos[0]);
  var coxaDegrees = phUtils.findValidAngle(coxaAngle, leg[0].range);

  var xd = pos[0];
  var yd = pos[1];
  var zd = pos[2];

  var xd_sq = xd * xd;
  var yd_sq = yd * yd;
  var zd_sq = zd * zd;

  var hypot = Math.sqrt(xd_sq + yd_sq + zd_sq);
  var hypot2d = Math.sqrt(xd_sq + zd_sq);
  
  var femurAngle = phUtils.solveAngle(hypot, phoenix.bones.FEMUR, phoenix.bones.TIBIA) + Math.sin(yd/hypot2d);
  var tibiaAngle = phUtils.solveAngle(phoenix.bones.FEMUR, phoenix.bones.TIBIA, hypot);

  if (isNaN(femurAngle) || isNaN(tibiaAngle)) {
    invalid = true;
  }

  var femurDegrees = phUtils.findValidAngle(femurAngle, leg[1].range);
  var tibiaDegrees = phUtils.findValidAngle(tibiaAngle, leg[2].range);

  if (coxaDegrees > 360 || femurDegrees > 360 || tibiaDegrees > 360) {
    invalid = true;
  }

  if (coxaDegrees < -360 || femurDegrees < -360 || tibiaDegrees < -360) {
    invalid = true;
  }

  if (!invalid) {
    leg[0].to(coxaDegrees);
    leg[1].to(femurDegrees);
    leg[2].to(tibiaDegrees);
    console.log(coxaDegrees, femurDegrees, tibiaDegrees);

  }

};

var board = new five.Board().on("ready", function() {

  phoenix.height = 0;
  phoenix.xShift = 0;
  phoenix.zShift = 0;

  // Right front leg
  phoenix.r1c = new five.Servo({pin:40, offset: 24, startAt: 0, range: [0, 90] });
  phoenix.r1f = new five.Servo({pin:39, offset: 87, startAt: 78, range: [-80, 78] });
  phoenix.r1t = new five.Servo({pin:38, offset: 165, invert: true, startAt: -140, range: [-160, -10] });
  phoenix.r1 = new five.Servo.Array([ phoenix.r1c, phoenix.r1f, phoenix.r1t ]);

  // Left front leg
  phoenix.l1c = new five.Servo({pin:27, offset: -31, startAt: 180, range: [90, 180] });
  phoenix.l1f = new five.Servo({pin:26, offset: -77, startAt: 102, range: [110, 260] });
  phoenix.l1t = new five.Servo({pin:25, offset: -176, invert: true, startAt: 320, range: [180, 340] });
  phoenix.l1 = new five.Servo.Array([ phoenix.l1c, phoenix.l1f, phoenix.l1t ]);

  // Right mid leg
  phoenix.r2c = new five.Servo({pin:49, offset: 86, startAt: 0, range: [-60, 60] });
  phoenix.r2f = new five.Servo({pin:48, offset: 78, startAt: 78, range: [-80, 78] });
  phoenix.r2t = new five.Servo({pin:47, offset: 187, invert: true, startAt: -140, range: [-160, -10] });
  phoenix.r2 = new five.Servo.Array([ phoenix.r2c, phoenix.r2f, phoenix.r2t ]);

  // Left mid leg
  phoenix.l2c = new five.Servo({pin:23, offset: -84, startAt: 180, range: [120, 240] });
  phoenix.l2f = new five.Servo({pin:21, offset: -76, startAt: 102, range: [110, 260] });
  phoenix.l2t = new five.Servo({pin:20, offset: -185, invert: true, startAt: 320, range: [180, 340] });
  phoenix.l2 = new five.Servo.Array([ phoenix.l2c, phoenix.l2f, phoenix.l2t ]);

  // Right rear leg
  phoenix.r3c = new five.Servo({pin:45, offset: 155, startAt: 0, range: [-90, 0] });
  phoenix.r3f = new five.Servo({pin:44, offset: 79, startAt: 78, range: [-80, 78] });
  phoenix.r3t = new five.Servo({pin:43, offset: 185, invert: true, startAt: -140, range: [-160, -10] });
  phoenix.r3 = new five.Servo.Array([ phoenix.r3c, phoenix.r3f, phoenix.r3t ]);

  // Left rear leg
  phoenix.l3c = new five.Servo({pin:19, offset: -141, startAt: 180, range: [161, 235] });
  phoenix.l3f = new five.Servo({pin:18, offset: -83, startAt: 102, range: [110, 260] });
  phoenix.l3t = new five.Servo({pin:17, offset: -182, invert: true, startAt: 320, range: [180, 340] });
  phoenix.l3 = new five.Servo.Array([ phoenix.l3c, phoenix.l3f, phoenix.l3t ]);

  phoenix.legs = new five.Servo.Array([phoenix.r1, phoenix.l1, phoenix.r2, phoenix.l2, phoenix.r3, phoenix.l3]);
  phoenix.legs[five.Animation.render] = legsRender;

  phoenix.r1[five.Animation.render] = legRender;
  phoenix.r2[five.Animation.render] = legRender;
  phoenix.r3[five.Animation.render] = legRender;
  phoenix.l1[five.Animation.render] = legRender;
  phoenix.l2[five.Animation.render] = legRender;
  phoenix.l3[five.Animation.render] = legRender;

  phoenix.r1.origin = [4.25, 2.875, 8.15];
  phoenix.l1.origin = [-4.25, 2.875, 8.15];
  phoenix.r2.origin = [6.25, 2.875, 0];
  phoenix.l2.origin = [-6.25, 2.875, 0];
  phoenix.r3.origin = [4.25, 2.875, -8.15];
  phoenix.l3.origin = [-4.25, 2.875, -8.15];

  phoenix.r1.home = [ 11.25, 0,  12.15];
  phoenix.l1.home = [-11.25, 0,  12.15];
  phoenix.r2.home = [ 14.25, 0,  0.1];
  phoenix.l2.home = [-14.25, 0,  0.1];
  phoenix.r3.home = [ 11.25, 0, -12];
  phoenix.l3.home = [-11.25, 0, -12];

  phoenix.bot = {
    "@@render": function(pos) {
      phoenix.xShift = pos[0][0] || phoenix.xShift;
      phoenix.height = pos[0][1] || phoenix.height;
      phoenix.zShift = pos[0][2] || phoenix.zShift;
      phoenix.render();
    },
    "@@normalize": function(keyFrames) {
      return keyFrames;
    }
  };

  phoenix.animation = new five.Animation(phoenix.bot);

  phoenix.setSleep = function() {
    phoenix.legs[five.Animation.render](phoenix.positions.sleep);
  };

// ph.r1["@@render"]([11.25, 0, 12.15])
  phoenix.render = function() {
    phoenix.legs[five.Animation.render]([
      [11.25 - phoenix.xShift, 0 - phoenix.height, 12.15 + phoenix.zShift],
      [-11.25 - phoenix.xShift, 0 - phoenix.height, 12.15 + phoenix.zShift],
      [14.25 - phoenix.xShift, 0 - phoenix.height, 0.1 + phoenix.zShift],
      [-14.25 - phoenix.xShift, 0 - phoenix.height, 0.1 + phoenix.zShift],
      [11.2 - phoenix.xShift, 0 - phoenix.height, -12 + phoenix.zShift],
      [-11.25 - phoenix.xShift, 0 - phoenix.height, -12 + phoenix.zShift]
    ]);
    phoenix.locked = true;
    GLOBAL.setTimeout(function() {phoenix.locked = false;}, 1000/400);
  };

  phoenix.stand = {
    target: phoenix.bot,
    duration: 2000,
    cuePoints: [0, 0.5, 1.0],
    oncomplete: function() {
      phoenix.state = "stand";
    },
    keyFrames: [
      [{position: [null, 0, null]}, {position: [null, -2, null]}, {position: [null, 8, null]}]
    ]
  };

  phoenix.s = function() {
    phoenix.animation.enqueue(phoenix.stand);
  };

  this.repl.inject({
     ph: phoenix
  });

});

Leap.loop({enableGestures: true}, function(frame) {

  if (frame.hands.length === 1) {
    if (!phoenix.locked) {

      phoenix.height = frame.hands[0].palmPosition[1];
      phoenix.height = [
        [50, 200, 0, 3],
        [200, 400, 3, 10],
        [400, Number.POSITIVE_INFINITY, 10, 10]
      ].reduce(function(pVal, cVal) {
        if (frame.hands[0].palmPosition[1] >= cVal[0] && frame.hands[0].palmPosition[1] <= cVal[1] ) {
          return phUtils.fmap(phoenix.height, cVal[0], cVal[1], cVal[2], cVal[3]);
        } else {
          return pVal;
        }
      }, 0);

      phoenix.xShift = phUtils.gapmap(frame.hands[0].palmPosition[0], [-100, -15, -8, 0], 0, [15, 100, 0, 8]);
      phoenix.zShift = phUtils.gapmap(frame.hands[0].palmPosition[2], [-100, -15, -8, 0], 0, [15, 100, 0, 8]);

      phoenix.xMove = phUtils.gapmap(frame.hands[0].palmPosition[0], [-200, -100, -1, 0], 0, [100, 200, 0, 1]);
      phoenix.zMove = phUtils.gapmap(frame.hands[0].palmPosition[2], [-200, -100, -1, 0], 0, [100, 200, 0, 1]);

      phoenix.pitch = phUtils.gapmap(frame.hands[0].pitch(), [-0.75, -0.15, -0.25, 0], 0, [0.15, 0.75, 0, 0.25]);
      phoenix.roll = phUtils.gapmap(frame.hands[0].roll(), [-0.75, -0.15, -0.25, 0], 0, [0.15, 0.75, 0, 0.25]);
      phoenix.yaw = phUtils.gapmap(frame.hands[0].yaw(), [-0.75, -0.15, -0.25, 0], 0, [0.15, 0.75, 0, 0.25]);

      heightMeter.update(phoenix.height);
      xMeter.update(phoenix.xShift);
      zMeter.update(phoenix.zShift);

      xMove.update(phoenix.xMove);
      zMove.update(phoenix.zMove);

      yawMeter.update(phoenix.yaw);
      rollMeter.update(phoenix.roll);
      pitchMeter.update(phoenix.pitch);

      phoenix.render();
    }
  }

  if (frame.hands.length === 0 && phoenix.state !== "stand" && phoenix.state !== "sleep") {
    //setState('stop');
  }

});

var heightMeter = new Barcli({label: "Height", range: [0, 10], precision: 4});
var xMeter = new Barcli({label: "X Offset", range: [-8, 8], constrain: true, precision: 4 });
var zMeter = new Barcli({label: "Z Offset", range: [-8, 8], constrain: true, precision: 4 });

var xMove = new Barcli({label: "X Move", range: [-1, 1], constrain: true, precision: 4 });
var zMove = new Barcli({label: "Z Move", range: [-1, 1], constrain: true, precision: 4 });

var yawMeter = new Barcli({label: "Yaw", range: [-0.25, 0.25], precision: 4});
var rollMeter = new Barcli({label: "Roll", range: [-0.25, 0.25], precision: 4});
var pitchMeter = new Barcli({label: "Pitch", range: [-0.25, 0.25], precision: 4});
