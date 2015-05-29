module.exports = {

  radToDeg: function(x) {
    return x / Math.PI * 180;
  },

  degToRad: function(x) {
    return x / 180 * Math.PI;
  },

  solveAngle: function(a, b, c) {
    return Math.acos((a * a + b * b - c * c) / (2 * a * b));
  },

  findValidAngle: function(angle, range) {
    var degrees = this.radToDeg(angle);
    var quadrant = 1;

    if (degrees > range[1] || degrees < range[0]) {

      // Try adding 180
      if (degrees + 180 >= range[0] && degrees + 180 <= range[1]) {
        degrees = degrees + 180;
        return degrees;
      }

      // Try subtracting 180
      if (degrees - 180 >= range[0] && degrees - 180 <= range[1]) {
        degrees = degrees - 180;
        return degrees;
      }
      return false;
    }

    return degrees;

  },

  map: function(value, fromLow, fromHigh, toLow, toHigh) {
    return this.fmap(value, fromLow, fromHigh, toLow, toHigh) | 0;
  },

  fmap: function(value, fromLow, fromHigh, toLow, toHigh) {
    return constrain(
      (value - fromLow) * (toHigh - toLow) /
        (fromHigh - fromLow) + toLow,
      toLow, toHigh);
  },

  constrain: function(value, lower, upper) {
    return Math.min(upper, Math.max(lower, value));
  },

  gapmap: function(value, lowRange, gap, highRange) {

    var result = gap;

    if (value <= lowRange[1]) {
      result = fmap(value, lowRange[0], lowRange[1], lowRange[2], lowRange[3]);
    }
    if (value >= highRange[0]) {
      result = fmap(value, highRange[0], highRange[1], highRange[2], highRange[3]);
    }

    return constrain(result, lowRange[2], highRange[3]);
  }
};
