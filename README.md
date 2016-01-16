# phoenix

This is the repo for my hexapod code. It is not intended for reuse but you are free to do what you will with it.

All the input is done with a leap motion controller.

## phoenix.js
This file uses scripted movements to walk, turn, etc. It's great for seeing how Johnny-Five animations work, but it's a sub-optimal way to do things.

## ikphoenix.js
This file uses [tharp](https://github.com/dtex/tharp) to solve kinematic chains to position the end effectors. So far it just stands, sleeps and translates/rotates the robots body. Still need to add walking sequences.

## t2phoenix.js
This is a copy of ikPhoenix.js that I use for testing on the Tessel 2.
