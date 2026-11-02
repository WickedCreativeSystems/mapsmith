# Mapsmith for Foundry VTT

Towns, dungeons, ships and buildings from a seed, made into scenes.

## Install

In Foundry, go to Add-on Modules, then Install Module, and paste this into Manifest URL:

```
https://bulkhead.bananafest-destiny.com/mapsmith/foundry/module.json
```

Turn it on in your world under Manage Modules.

## Use

As the GM, open the Scenes tab and press **Mapsmith map**. Pick a town, dungeon, ship or building, choose its size and kind, and keep or change the seed. Press **Make the scene**.

You get:

- the map, drawn and uploaded to `mapsmith/` in your world's data folder;
- a scene with the grid already lined up with the map (a town's squares are in metres, a plan's are five feet);
- a journal, GM-only, with what happened there and every numbered place or room: who is there, what is in it, and a hook;
- a ship or a building with more than one deck or floor gets a scene for each.

The same seed always gives the same map. The journal's first page has the block that opens it in the Mapsmith plugin for Obsidian or on the web at https://bulkhead.bananafest-destiny.com/mapsmith/.

## Mapsmith Pro

With a Mapsmith Pro key, every scene Mapsmith makes also gets its walls, doors and lights. A dungeon is ready for vision and fog of war the moment it opens.

Pro is $6 once, on itch: https://bananafestdestiny.itch.io/mapsmith-pro. The same key unlocks the Obsidian plugin and the web version. Paste the address of your itch download page, or the key at the end of it, into Configure Settings, Mapsmith, Mapsmith Pro key.

Without a key, everything else works and nothing is cut off.

## Network and privacy

The module goes online once each time you save a key, to check it with Mapsmith's server. Nothing else leaves your Foundry server: the maps are drawn in your browser and saved in your world. No analytics.

## How it is made

The maps are drawn by code, lines and fills, with no generated images. The code was written with AI help. The Obsidian plugin's painted look uses image-generator textures; this module leaves them out.

## Licence

MIT. Source: https://github.com/walkertbrown/mapsmith (the `foundry/` folder).
