import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOurImage } from './storage.js';

// Sem SUPABASE_URL, só aceita imagens enviadas para server/uploads
test('imagem do post precisa ter sido enviada por nós', () => {
  assert.equal(isOurImage('/uploads/post-123e4567.jpg'), true);
  assert.equal(isOurImage('/uploads/../.env'), false);
  assert.equal(isOurImage('https://site-qualquer.com/foto.jpg'), false);
  assert.equal(isOurImage('javascript:alert(1)'), false);
});
