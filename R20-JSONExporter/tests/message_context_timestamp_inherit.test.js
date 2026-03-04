const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveMessageContext } = require('../js/content/export/message_context_parser.js');

test('resolveMessageContext inherits timestamp when current timestamp is missing', () => {
  const previous = {
    speaker: '곤도 루이',
    avatarSrc: 'https://example.com/avatar.png',
    speakerImageUrl: 'https://example.com/avatar.png',
    timestamp: 'April 30, 2023 2:11PM',
  };

  const current = {
    speaker: '',
    avatarSrc: '',
    speakerImageUrl: '',
    timestamp: '',
  };

  const resolved = resolveMessageContext(current, previous);

  assert.equal(resolved.speaker, '곤도 루이');
  assert.equal(resolved.avatarSrc, 'https://example.com/avatar.png');
  assert.equal(resolved.timestamp, 'April 30, 2023 2:11PM');
});
