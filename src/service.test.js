const request = require('supertest');
const app = require('./service');

test('test if get works', async () => {
  const response = await request(app).get('/');
  expect(response.status).toBe(200);

  expect(response.body.message).toBe('welcome to JWT Pizza');
  expect(response.body.version).toBeDefined();
});

test('test if get shows error', async () => {
    const response = await request(app).get('/fakeroute');
    expect(response.status).toBe(404);

    expect(response.body.message).toBe('unknown endpoint');
  });
