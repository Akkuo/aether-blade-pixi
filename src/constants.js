export const ROOM_COLS = 20;
export const ROOM_ROWS = 12;
export const TILE_SIZE = 16;
export const PLAY_W = ROOM_COLS * TILE_SIZE; // 320
export const PLAY_H = ROOM_ROWS * TILE_SIZE; // 192
export const HUD_H = 24;
export const VIEW_W = PLAY_W;               // 320
export const VIEW_H = PLAY_H + HUD_H;       // 216 (16:10.8, crisp 16-bit Zelda ratio)

export const DIR = {
  DOWN: 0,
  UP: 1,
  LEFT: 2,
  RIGHT: 3,
};

export const DIR_VEC = [
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

export const STATE = {
  TITLE: 'title',
  PLAYING: 'playing',
  TRANSITION: 'transition',
  DIALOGUE: 'dialogue',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
  VICTORY: 'victory',
};

export const TILE = {
  GRASS: 0,
  PATH: 1,
  TREE: 2,
  WATER: 3,
  BUSH: 4,         // Cuttable with sword!
  ROCK: 5,         // Solid rock
  CRACKED_WALL: 6, // Destroyable with Bomb!
  DUNGEON_FLOOR: 7,
  DUNGEON_WALL: 8,
  PUSH_BLOCK: 9,   // Pushable stone block
  SWITCH: 10,      // Floor pressure switch
  LOCKED_DOOR: 11, // Opens with Small Key or room puzzle
  TORCH: 12,       // Glowing wall/floor torch
  STAIRS_IN: 13,   // Enter Sanctuary Dungeon
  STAIRS_OUT: 14,  // Exit to Overworld
  FLOWERS: 15,
  BRIDGE: 16,
  SIGN: 17,
  PEDESTAL: 18,
  POT: 19,          // Smashable ceramic pot (drops loot!)
  CRYSTAL_ORB: 20,  // Hit to toggle Red/Blue barriers!
  RED_BLOCK: 21,    // Raised when crystalState === 0
  BLUE_BLOCK: 22,   // Raised when crystalState === 1
  BRAZIER_OFF: 23,  // Unlit brazier — ignite with Fire Rod!
  BRAZIER_ON: 24,   // Lit brazier
  FAIRY_SPRING: 25, // Sparkling healing fairy fountain!
};
