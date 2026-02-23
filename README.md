# Paper & Scissors

A silly little multiplayer game where you run around as a piece of paper and throw scissors at each other.

That's it. That's the game.

## Incredibly Low Res Gameplay Gif

![Alt text](img/game.gif)

## Gameplay

- **Left click** to move your paper
- **Right click** to throw scissors at someone
- Hit another player's paper with scissors and they die
- Get hit by scissors and you die — you become a sad dead piece of paper and can't do anything :(

- Was gonna add interactions with paper shredders but wayyy too much work

## Tech Stack

- **Frontend:** Vanilla JavaScript (Canvas API)
- **Backend:** Node.js
- **Communication:** HTTP

## Setup & Running

**Requirements:** Node.js

```bash
node server.js
```

Then open your browser to:

```
http://127.0.0.1:8082
```

To play with friends
1. Have friends
2. Change the `host` in `server.js` to your local network IP and send them the link

* **Note:** This is untested as I do not fullfill the initial requirement for setup. This should work according to my Networks class though ¯\\_(ツ)_/¯
