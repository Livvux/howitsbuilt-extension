import { createEngine, type Engine } from '@howitsbuilt/engine';
import categories from '@howitsbuilt/engine/data/categories.json';
import technologies from '@howitsbuilt/engine/data/technologies.json';

let engine: Engine | undefined;

/** Compiled on first use, i.e. on every popup open (the popup is a fresh page each time; ~0.2 s on a CI VM). */
export function getEngine(): Engine {
  engine ??= createEngine(technologies as Record<string, unknown>, categories);
  return engine;
}
