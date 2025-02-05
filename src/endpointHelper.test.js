const { asyncHandler, StatusCodeError } = require('./endpointHelper');

test('check tosee if it creates a StatusCodeError with a message and statusCode', () => {
  const message = 'Not Found';
  const statusCode = 404;
  const error = new StatusCodeError(message, statusCode);

  expect(error).toBeInstanceOf(StatusCodeError);
  expect(error.message).toBe(message);
  expect(error.statusCode).toBe(statusCode);
});

test('check the next middleware works when an async function succeeds', async () => {
  const req = {};
  const res = {};
  const next = jest.fn();
  
  const asyncFunction = async (req, res, next) => {
    res.statusCode = 200;
    next();
  };

  const wrapped = asyncHandler(asyncFunction);
  await wrapped(req, res, next);

  expect(next).toHaveBeenCalled();
});