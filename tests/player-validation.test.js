import test from 'node:test';
import assert from 'node:assert/strict';
import { primaryPositionCode, validatePlayerProfileUpdate } from '../server/services/validation.js';

test('primary position aliases resolve to the same Squad Builder code', () => {
  assert.equal(primaryPositionCode('CM'), 'CM');
  assert.equal(primaryPositionCode('Central Midfielder'), 'CM');
  assert.equal(primaryPositionCode('  central   midfielder '), 'CM');
  assert.equal(primaryPositionCode('CAM'), 'CAM');
  assert.equal(primaryPositionCode('Central Attacking Midfielder'), 'CAM');
  assert.equal(primaryPositionCode('LM'), 'LM');
  assert.equal(primaryPositionCode('Left Attacking Midfielder'), 'LM');
  assert.equal(primaryPositionCode('not a position'), '');
});

test('player profile validation accepts supported preferred feet and valid dates', () => {
  for (const preferredFoot of ['', 'Left', 'Right', 'Both']) {
    assert.equal(validatePlayerProfileUpdate({ preferredFoot, dateOfBirth: '2006-07-01' }), true);
  }
  assert.equal(validatePlayerProfileUpdate({ preferredFoot: '', dateOfBirth: '' }), true);
  assert.equal(validatePlayerProfileUpdate({ preferredFoot: 'Right', dateOfBirth: null }), true);
});

test('player profile validation rejects invalid preferred feet and dates', () => {
  assert.throws(() => validatePlayerProfileUpdate({ preferredFoot: 'Lefty', dateOfBirth: '2006-07-01' }), /Preferred foot is invalid/);
  assert.throws(() => validatePlayerProfileUpdate({ preferredFoot: 'Right', dateOfBirth: 'not-a-date' }), /Date of birth is invalid/);
});
