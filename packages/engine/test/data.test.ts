import tech from '../data/technologies.json';
import cats from '../data/categories.json';

test('fingerprints present', () => {
  expect(Object.keys(tech).length).toBeGreaterThan(3000);
  expect((tech as any)['Next.js'].implies).toContain('React');
  expect((cats as any)['1'].name).toBe('CMS');
});
