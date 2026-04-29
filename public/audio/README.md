Audio asset layout:

- `crowd/`: active in-game ambience and short one-shot effects
- `candidates/`: downloaded source candidates kept for review
- `carousel-candidates/`: carousel music candidates kept for review
- `ride-reaction-candidates/`: downloaded ride reaction audio candidates kept for review
- `ride-effects/`: active short ride reaction effects

The app currently mixes real crowd recordings through Web Audio and scales volume by guest density, zoom, and camera target distance.

Current active crowd files:

- `crowd/festival-crowd-walla.ogg`: main public domain crowd walla layer
- `candidates/high-school-cafeteria.ogg`: quiet public domain cafeteria crowd bed, mixed at low volume
- `crowd/mall-less-crowded.ogg`: public domain quieter mall/crowd bed, mixed as support
- `crowd/mall-alexa-bed.ogg`: public domain mall/crowd bed, mixed quietly as support
- `crowd/baby-cry-2s-cc0.ogg`: short CC0 baby cry one-shot, triggered very rarely
- `laughter-candidates/small-group-laughter.ogg`: short laughter one-shot
- `laughter-candidates/laughter-public-domain.ogg`: first second used as an occasional laughter one-shot
- `ride-effects/stealth-launch-reaction-3-9s.ogg`: background ride reaction layer, triggered occasionally
- `ride-effects/oblivion-happy-squeal-3-4s.ogg`: short happy ride squeal, triggered occasionally

Candidate files are not automatically used unless referenced from `src/main.ts`.

The map includes four visible audio test zones. Moving the camera near each zone adds a debug crowd-density amount so the crowd mix can be auditioned by density without spawning hundreds of simulated guests.

OpenAI TTS helper layers can still be generated locally for testing with:

```bash
npm run generate:crowd-audio
```

Use only legally licensed files. Prefer CC0/public domain for files committed to the repository.
