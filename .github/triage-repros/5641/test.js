const assert = require('assert');

it('tagged Date', function () {
  const a = {x: 1, [Symbol.toStringTag]: 'Date'};
  const b = {x: 2, [Symbol.toStringTag]: 'Date'};
  assert.deepStrictEqual(a, b);
});
