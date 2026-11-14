// Rode com: npm test (na pasta server)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ageOf, hasOffensive } from './safety.js';

test('filtro não bloqueia frases normais', () => {
  const ok = ['Amei o show do BTS!', 'computador novo', 'Que fofo esse cupcake', 'cuidado com o spoiler', 'curti demais',
    'putz que legal', 'disputa no campeonato', 'a cultura pop', 'bichinho fofo', 'merecido demais', 'reputação',
    'porque sim', 'cumprimentos', 'fundo do mar', 'a capital do Peru', 'macaco no zoológico'];
  assert.deepEqual(ok.filter(hasOffensive), []);
});

test('filtro pega palavrões, abreviações e leetspeak', () => {
  const bad = ['vai tomar no cu', 'p0rr4 mano', 'que merda', 'VSF', 'caralhoooo', 'seu viado', 'fdp', 'puta que pariu', 'f*ck'];
  assert.deepEqual(bad.filter((t) => !hasOffensive(t)), ['f*ck']); // símbolo no meio da palavra ainda escapa (limitação conhecida)
});

test('idade: mínimo de 13 anos e datas inválidas', () => {
  const y = new Date().getUTCFullYear();
  assert.equal(ageOf(`${y - 20}-01-01`) >= 19, true);
  assert.throws(() => ageOf(`${y - 10}-01-01`), { message: 'too_young' });
  assert.throws(() => ageOf('2000-02-30'), { message: 'invalid_birth_date' });
  assert.throws(() => ageOf('01/02/2000'), { message: 'invalid_birth_date' });
  assert.throws(() => ageOf(`${y + 1}-01-01`), { message: 'invalid_birth_date' });
});
