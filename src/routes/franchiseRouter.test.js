const request = require('supertest');
const express = require('express');
const franchiseRouter = require('./franchiseRouter');
const { DB } = require('../database/database.js');
const { authRouter } = require('./authRouter');

jest.mock('../database/database.js');
jest.mock('./authRouter');
jest.mock('node-fetch');

const app = express();
app.use(express.json());
app.use('/api/franchise', franchiseRouter);

const mockUser = { id: 4, isRole: jest.fn().mockReturnValue(false) };
const authMiddleware = (req, res, next) => {
    req.user = mockUser;
    next();
};

beforeEach(() => {
    authRouter.authenticateToken.mockImplementation(authMiddleware);
});

test('check if getFranchises works correctly', async () => {
    const mockFranchises = [
        {
            id: 1,
            name: 'pizzaPocket',
            admins: [{ id: 4, name: 'pizza franchisee', email: 'f@jwt.com' }],
            stores: [{ id: 1, name: 'SLC', totalRevenue: 0 }],
        },
    ];

    DB.getFranchises.mockResolvedValue(mockFranchises);

    const getFranchiseRes = await request(app).get('/api/franchise');

    expect(getFranchiseRes.status).toBe(200);
    expect(getFranchiseRes.body).toEqual(mockFranchises);
    expect(DB.getFranchises).toHaveBeenCalled();
});

test('check if createFranchise works correctly', async () => {
    mockUser.isRole.mockReturnValue(true);

    const mockFranchise = {
        name: 'pizzaPocket',
        admins: [{ email: 'f@jwt.com' }]
    };
    const mockResponse = { ...mockFranchise, id: 1, admins: [{ email: 'f@jwt.com', id: 4, name: 'pizza franchisee' }] };

    DB.createFranchise.mockResolvedValue(mockResponse);

    const createFranchiseRes = await request(app).post('/api/franchise').set('Authorization', 'Bearer tttttt').send(mockFranchise);

    expect(createFranchiseRes.status).toBe(200);
    expect(createFranchiseRes.body).toEqual(mockResponse);
    expect(DB.createFranchise).toHaveBeenCalledWith(mockFranchise);
});

test('check if createFranchise works correctly', async () => {
    const franchiseId = 1;
    const mockStore = { name: 'SLC' };
    const mockFranchise = { id: franchiseId, admins: [{ id: 4, name: 'pizza franchisee', email: 'f@jwt.com' }] };
    const mockResponse = { id: 1, name: 'SLC', totalRevenue: 0 };

    DB.getFranchise.mockResolvedValue(mockFranchise);
    DB.createStore.mockResolvedValue(mockResponse);

    const createStoreRes = await request(app).post(`/api/franchise/${franchiseId}/store`).set('Authorization', 'Bearer tttttt').send(mockStore);

    expect(createStoreRes.status).toBe(200);
    expect(createStoreRes.body).toEqual(mockResponse);
    expect(DB.createStore).toHaveBeenCalledWith(franchiseId, mockStore);
});

test('check if getUserFranchises works correctly', async () => {
    const userId = 4;
    const mockUserFranchises = [
        {
            id: 1,
            name: 'pizzaPocket',
            admins: [{ id: 4, name: 'pizza franchisee', email: 'f@jwt.com' }],
            stores: [{ id: 1, name: 'SLC', totalRevenue: 0 }],
        },
    ];

    DB.getUserFranchises.mockResolvedValue(mockUserFranchises);

    const getUserFranchisesRes = await request(app)
        .get(`/api/franchise/${userId}`)
        .set('Authorization', 'Bearer tttttt');

    expect(getUserFranchisesRes.status).toBe(200);
    expect(getUserFranchisesRes.body).toEqual(mockUserFranchises);
    expect(DB.getUserFranchises).toHaveBeenCalledWith(userId);
});

test('check if deleteFranchise works correctly', async () => {
    const franchiseId = 1;
    const storeId = 1;
    const mockFranchise = { id: franchiseId, admins: [{ id: 4, name: 'pizza franchisee', email: 'f@jwt.com' }] };

    DB.getFranchise.mockResolvedValue(mockFranchise);
    DB.deleteStore.mockResolvedValue();

    const deleteStoreRes = await request(app).delete(`/api/franchise/${franchiseId}/store/${storeId}`).set('Authorization', 'Bearer tttttt');

    expect(deleteStoreRes.status).toBe(200);
    expect(deleteStoreRes.body).toEqual({ message: 'store deleted' });
    expect(DB.deleteStore).toHaveBeenCalledWith(franchiseId, storeId);
});