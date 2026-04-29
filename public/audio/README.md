Place crowd ambience loops here:

- `crowd-ambience.ogg`: continuous park crowd bed
- `crowd-laughs.ogg`: optional laughter and excited crowd layer
- `generated/crowd-chatter-*.mp3`: generated helper chatter layers
- `generated/crowd-laugh-*.mp3`: generated helper laughter layers

Use loopable, legally licensed files. The app mixes these through Web Audio and scales volume by guest density, zoom, and camera target distance.

Generated helper layers can be created locally with:

```bash
npm run generate:crowd-audio
```
