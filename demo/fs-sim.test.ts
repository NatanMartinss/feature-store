import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, sampleCustomers, runExperiment, auc } from './fs-sim.ts';

test('point-in-time never joins a value from the label day or later', () => {
  for (const c of sampleCustomers()) {
    for (let day = 1; day < 60; day++) {
      c.labelDay = day;
      const r = join(c, 'pit', 60);
      if (r.event) assert.ok(r.event.day < day, `${c.id}: label d${day} got value from d${r.event.day}`);
    }
  }
});

test('“latest value” leaks for every sample customer', () => {
  for (const c of sampleCustomers()) assert.equal(join(c, 'latest', 60).status, 'leak');
});

test('TTL turns a stale value into a missing one instead of passing it off as fresh', () => {
  const c104 = sampleCustomers().find((c) => c.id === 'C-104')!;
  assert.equal(join(c104, 'pit', 30).status, 'ok');
  const stale = join(c104, 'pit', 14);
  assert.equal(stale.status, 'stale');
  assert.equal(stale.event, null);
});

test('AUC is 1 for a perfect ranking and 0.5 for ties', () => {
  assert.equal(auc([0.1, 0.2, 0.8, 0.9], [0, 0, 1, 1]), 1);
  assert.equal(auc([0.5, 0.5, 0.5, 0.5], [0, 1, 0, 1]), 0.5);
});

test('the leaky model looks perfect offline and collapses in production', () => {
  const r = runExperiment(4000, 7);
  assert.ok(r.latest.offline > 0.95, `leaky offline ${r.latest.offline}`);
  assert.ok(r.latest.production < 0.65, `leaky production ${r.latest.production}`);
});

// Verdadeiro por construção: com point-in-time, offline e produção usam as mesmas features nas
// mesmas linhas. Isso demonstra a ausência de skew, mas não mede deriva no tempo; a avaliação
// num período posterior ao treino está no roteiro.
test('point-in-time: no training/serving gap (true by construction), and it beats the leaky model in production', () => {
  const r = runExperiment(4000, 7);
  assert.ok(Math.abs(r.pit.offline - r.pit.production) < 0.02);
  assert.ok(r.pit.production > r.latest.production + 0.15);
});
