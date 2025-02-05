const request = require('supertest');
const express = require('express');
const orderRouter = require('./orderRouter');
const { DB } = require('../database/database.js');
const { authRouter } = require('./authRouter');

jest.mock('../database/database.js');
jest.mock('./authRouter');
const fetch = require('node-fetch');
jest.mock('node-fetch'); 

const app = express();
app.use(express.json());
app.use('/api/order', orderRouter);

test('check if getMenu works correctly', async () => {
    const mockMenu = [{ id: 808, title: 'fruit pizza', description: 'fresh fruits for topping', image: 'pizza808.png', price: 0.001 }];
  
    DB.getMenu.mockResolvedValue(mockMenu);
  
    const getMenuRes = await request(app).get('/api/order/menu');
  
    expect(getMenuRes.status).toBe(200);
    expect(getMenuRes.body).toEqual(mockMenu);
    expect(DB.getMenu).toHaveBeenCalled();
  });

  test('check if addMenu item works correctly - user is an admin', async () => {
    const mockInitialMenu = [];
    const mockMenuItem = { title: 'hawaiian pizza', description: 'tropical fruits for topping', image: 'pizza809.png', price: 0.002 };
    const mockUpdatedMenu = [mockMenuItem];

    DB.getMenu.mockResolvedValue(mockInitialMenu);
    DB.addMenuItem.mockResolvedValue(mockMenuItem);
    DB.getMenu.mockResolvedValue(mockUpdatedMenu);

    const mockAdminUser = { id: 1, name: 'Admin User', email: 'admin@admin.com', isRole: jest.fn().mockReturnValue(true) };
    authRouter.authenticateToken.mockImplementation((req, res, next) => {
        req.user = mockAdminUser;
        next();
    });

    const res = await request(app).put('/api/order/menu').send(mockMenuItem).set('Authorization', 'Bearer fakeToken');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockUpdatedMenu);
    expect(DB.addMenuItem).toHaveBeenCalledWith(mockMenuItem);
    expect(DB.getMenu).toHaveBeenCalled();
});

test('check is createOrder works correctly', async () => {
    const mockOrderReq = { franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: 'Veggie', price: 0.001 }] };
    const mockOrder = { id: 1, franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: 'Veggie', price: 0.0001 }] };

    DB.addDinerOrder.mockResolvedValue(mockOrder);

    const mockFactoryResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ reportUrl: 'http://factory/report', jwt: 'sample-jwt' })
    };
    fetch.mockResolvedValue(mockFactoryResponse);

    const mockUser = { id: 1, name: 'Test User', email: 'user@test.com' };
    authRouter.authenticateToken.mockImplementation((req, res, next) => {
        req.user = mockUser;
        next();
    });

    const res = await request(app).post('/api/order').send(mockOrderReq).set('Authorization', 'Bearer fakeToken');

    expect(res.status).toBe(200);
    expect(res.body.order).toEqual(mockOrder);
    expect(DB.addDinerOrder).toHaveBeenCalledWith(mockUser, mockOrderReq);
});