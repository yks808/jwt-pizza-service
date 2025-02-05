const request = require('supertest');
const app = require('../service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  testUser.id = registerRes.body.user.id;
  expectValidJwt(testUserAuthToken);
});

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);

});

test('logout',async() => {
    const logoutRes = await request(app).delete('/api/auth').set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.message).toBe('logout successful');
});

test('registry missing info', async() => {
    const missingNameUserRes = await request(app).post('/api/auth').send({ email: 'hello@test.com', password: 'abc' });
    expect(missingNameUserRes.status).toBe(400);
    expect(missingNameUserRes.body.message).toBe('name, email, and password are required');

    const missingEmailUserRes = await request(app).post('/api/auth').send({ name: 'New User', password: 'abc' });
    expect(missingEmailUserRes.status).toBe(400);
    expect(missingEmailUserRes.body.message).toBe('name, email, and password are required');

    const missingPasswordUserRes = await request(app).post('/api/auth').send({ name: 'New User', email: 'hello@test.com' });
    expect(missingPasswordUserRes.status).toBe(400);
    expect(missingPasswordUserRes.body.message).toBe('name, email, and password are required');
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}

test('updateUser with without authorization', async () => {
  const res = await request(app).put(`/api/auth/${testUser.id}`).set('Authorization', `Bearer faketoken`)
    .send({ email: 'faketoken@test.com', password: 'fakepassword' });
  expect(res.status).toBe(401);
  expect(res.body.message).toBe('unauthorized');
});