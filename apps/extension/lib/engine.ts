import { createEngine, type Engine } from '@howitsbuilt/engine';
import categories from '@howitsbuilt/engine/data/categories.json';
import technologies from '@howitsbuilt/engine/data/technologies.json';

let engine: Engine | undefined;

/** Compiled once per service-worker lifetime (~40 ms). */
export function getEngine(): Engine {
  engine ??= createEngine(technologies as Record<string, unknown>, categories);
  return engine;
}
