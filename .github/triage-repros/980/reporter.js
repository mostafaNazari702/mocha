module.exports = function (runner) {
  runner.on('fail', function () {
    throw new Error('boom');
  });
};
