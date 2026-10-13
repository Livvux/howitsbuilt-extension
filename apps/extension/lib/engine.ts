import { createEngine, type Engine } from '@howitsbuilt/engine';
import categories from '@howitsbuilt/engine/data/categories.json';
import technologies from '@howitsbuilt/engine/data/technologies.json';

let engine: Engine | undefined;

/** Created on every popup open (the popup is a fresh page each time); only probes are built here, patterns compile via warm()/match(). */
export function getEngine(): Engine {
  engine ??= createEngine(technologies as Record<string, unknown>, categories);
  return engine;
}
