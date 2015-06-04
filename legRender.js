var vector = require("vektor").vector,
  rotate = require("vektor").rotate,
  matrix = require("vektor").matrix;

module.exports = {

  // Find an end effector's position relative to the kinematic chain origin
  //
  // @param {Object} opts Options: {position[, origin][, orientation] }
  //  - opts.position {Array}: Three tuple of end effector position
  //    relative to the robots origin point
  //  - opts.origin {Array}: Three tuple of kinematic chain origin relative
  //    to the robots origin point
  //  - opts.orientation {Object}: {[pitch][, roll][, yaw]}
  //    pitch, roll and yaw are given in radians
  eePosition: function(opts) {

    var pos = opts.position || [0, 0, 0];
    var oPos = opts.origin || [0, 0, 0];
    var orientation = opts.orientation || {};
    var roll = orientation.roll || 0;
    var pitch = orientation.pitch || 0;
    var yaw = orientation.yaw || 0;

    var posVector = new vector(pos);
    var oPosVector = new vector(oPos);

    var rotationMatrix = new rotate.RotZ(roll);
    posVector = rotationMatrix.dot(posVector);
    oPosVector = rotationMatrix.dot(oPosVector);

    rotationMatrix = new rotate.RotX(pitch);
    posVector = rotationMatrix.dot(posVector);
    oPosVector = rotationMatrix.dot(oPosVector);

    rotationMatrix = new rotate.RotY(yaw);
    posVector = rotationMatrix.dot(posVector);
    oPosVector = rotationMatrix.dot(oPosVector);

    oPosVector = oPosVector.scale(-1);

    posVector = posVector.add(oPosVector);

    pos = posVector.v;

    return pos;
  },

  leg: function( phoenix, leg, position, progress, index ) {

    var pos = position;
    var invalid = false;
    var posMatrix = new matrix(1,3);
    posMatrix.m = pos;

    pos = eePosition(pos, oPos, phoenix);

    pos = [pos[0] - leg.origin[0], pos[1] - leg.origin[1], pos[2] - leg.origin[2]];

    var xd = pos[0];
    var yd = pos[1];
    var zd = pos[2];

    var xd_sq = xd * xd;
    var yd_sq = yd * yd;
    var zd_sq = zd * zd;

    var hypot = Math.sqrt(xd_sq + yd_sq + zd_sq);
    var hypot2d = Math.sqrt(xd_sq + zd_sq);

    var coxaAngle = Math.atan(pos[2]/pos[0]);
    var coxaDegrees = phUtils.findValidAngle(coxaAngle, leg[0].range, true);

    if (index % 2 === 1) {
      phoenix.bones.FEMUR *= -1;
    }

    var femurAngle = phUtils.solveAngle(phoenix.bones.FEMUR, hypot, phoenix.bones.TIBIA);

    angleRads.update(femurAngle);
    //if (index % 2 === 1) {
      femurAngle -= Math.sin(yd/hypot2d);
    //} else {
    //  femurAngle += Math.sin(yd/hypot2d);
  //  }
    var femurDegrees = phUtils.findValidAngle(femurAngle, leg[1].range);

    var tibiaAngle = phUtils.solveAngle(phoenix.bones.FEMUR, phoenix.bones.TIBIA, hypot);
    var tibiaDegrees = phUtils.findValidAngle(tibiaAngle, leg[2].range);

    leg.angles = [coxaDegrees, femurDegrees, tibiaDegrees];
  }
};
