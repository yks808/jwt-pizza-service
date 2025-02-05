const db = require('./database');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

jest.mock('mysql2/promise');
jest.mock('bcrypt');

describe('Database Tests', () => {
  let mockConnection;

  beforeEach(() => {
    mockConnection = {
      execute: jest.fn(),
      end: jest.fn(),
      query: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn()
    };
    mysql.createConnection.mockResolvedValue(mockConnection);
  });

  test('getMenu returns all menu items', async () => {
    const mockMenuItems = [
      { id: 1, title: 'Burger', price: 10.99 },
      { id: 2, title: 'Pizza', price: 12.99 }
    ];
    mockConnection.execute.mockResolvedValueOnce([mockMenuItems]);

    const result = await db.DB.getMenu();
    
    expect(mockConnection.execute).toHaveBeenCalledWith('SELECT * FROM menu', undefined);
    expect(result).toEqual(mockMenuItems);
    expect(mockConnection.end).toHaveBeenCalled();
  });

  test('addMenuItem adds new menu item successfully', async () => {
    const newItem = {
      title: 'Pasta',
      description: 'Italian pasta',
      image: 'pasta.jpg',
      price: 15.99
    };
    const mockInsertResult = { insertId: 1 };
    mockConnection.execute.mockResolvedValueOnce([mockInsertResult]);

    const result = await db.DB.addMenuItem(newItem);
    
    expect(mockConnection.execute).toHaveBeenCalledWith(
      'INSERT INTO menu (title, description, image, price) VALUES (?, ?, ?, ?)',
      [newItem.title, newItem.description, newItem.image, newItem.price]
    );
    expect(result).toEqual({ ...newItem, id: 1 });
  });

  test('addUser creates new user with hashed password', async () => {
    const newUser = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password123',
      roles: [{ role: 'admin' }]
    };
    const hashedPassword = 'hashedPassword123';
    const mockUserInsert = { insertId: 1 };
    
    bcrypt.hash.mockResolvedValueOnce(hashedPassword);
    mockConnection.execute.mockResolvedValueOnce([mockUserInsert]);
    mockConnection.execute.mockResolvedValueOnce([[]]);

    const result = await db.DB.addUser(newUser);
    
    expect(bcrypt.hash).toHaveBeenCalledWith(newUser.password, 10);
    expect(mockConnection.execute).toHaveBeenCalledWith(
      'INSERT INTO user (name, email, password) VALUES (?, ?, ?)',
      [newUser.name, newUser.email, hashedPassword]
    );
    expect(result).toEqual({
      ...newUser,
      id: 1,
      password: undefined
    });
  });

  test('getUser authenticates user successfully', async () => {
    const email = 'john@example.com';
    const password = 'password123';
    const mockUser = {
      id: 1,
      email,
      password: 'hashedPassword',
      name: 'John Doe'
    };
    const mockRoles = [{ objectId: 1, role: 'admin' }];

    mockConnection.execute.mockResolvedValueOnce([[mockUser]]);
    mockConnection.execute.mockResolvedValueOnce([mockRoles]);
    bcrypt.compare.mockResolvedValueOnce(true);

    const result = await db.DB.getUser(email, password);
    
    expect(mockConnection.execute).toHaveBeenCalledWith(
      'SELECT * FROM user WHERE email=?',
      [email]
    );
    expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.password);
    expect(result).toEqual({
      ...mockUser,
      roles: mockRoles.map(r => ({ objectId: r.objectId, role: r.role })),
      password: undefined
    });
  });

  test('getOrders retrieves user orders with items', async () => {
    const userId = 1;
    const mockOrders = [
      { id: 1, franchiseId: 1, storeId: 1, date: '2024-02-05' }
    ];
    const mockItems = [
      { id: 1, menuId: 1, description: 'Burger', price: 10.99 }
    ];

    mockConnection.execute
      .mockResolvedValueOnce([mockOrders])
      .mockResolvedValueOnce([mockItems]);

    const result = await db.DB.getOrders({ id: userId });

    expect(result).toEqual({
      dinerId: userId,
      orders: [{ ...mockOrders[0], items: mockItems }],
      page: 1
    });
  });
  test('loginUser stores authentication token', async () => {
    const userId = 1;
    const token = 'jwt.token.signature';
    
    mockConnection.execute.mockResolvedValueOnce([{ insertId: 1 }]);
    
    await db.DB.loginUser(userId, token);
    
    expect(mockConnection.execute).toHaveBeenCalledWith(
      'INSERT INTO auth (token, userId) VALUES (?, ?)',
      ['signature', userId]
    );
    expect(mockConnection.end).toHaveBeenCalled();
  });

  test('addDinerOrder creates new order with items', async () => {
    const userId = 1;
    const order = {
      franchiseId: 1,
      storeId: 1,
      items: [{ menuId: 1, description: 'Burger', price: 10.99 }]
    };
  
    mockConnection.execute
      .mockResolvedValueOnce([{ insertId: 1 }]) 
      .mockResolvedValueOnce([[{ id: 1 }]])  
      .mockResolvedValueOnce([{ insertId: 1 }]);
  
    const result = await db.DB.addDinerOrder({ id: userId }, order);
  
    expect(mockConnection.execute).toHaveBeenCalledWith(
      'INSERT INTO dinerOrder (dinerId, franchiseId, storeId, date) VALUES (?, ?, ?, now())',
      [userId, order.franchiseId, order.storeId]
    );
    expect(result).toEqual({ ...order, id: 1 });
  });
  test('createFranchise creates new franchise with admins', async () => {
    const franchise = {
      name: 'Test Franchise',
      admins: [{ email: 'admin@test.com' }]
    };
  
    mockConnection.execute
      .mockResolvedValueOnce([[{ id: 1, name: 'Admin User' }]]) 
      .mockResolvedValueOnce([{ insertId: 1 }])                 
      .mockResolvedValueOnce([{ insertId: 1 }]);   
  
    const result = await db.DB.createFranchise(franchise);
  
    expect(result).toEqual({
      id: 1,
      name: 'Test Franchise',
      admins: [{ 
        email: 'admin@test.com',
        id: 1,
        name: 'Admin User'
      }]
    });
  });
 
  test('deleteFranchise deletes franchise and associated data successfully', async () => {
    const franchiseId = 1;
    
    mockConnection.execute
      .mockResolvedValueOnce([{}]) 
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]); 
    
    await db.DB.deleteFranchise(franchiseId);
  
    expect(mockConnection.execute).toHaveBeenCalledWith(
      'DELETE FROM store WHERE franchiseId=?',
      [franchiseId]
    );
    expect(mockConnection.execute).toHaveBeenCalledWith(
      'DELETE FROM userRole WHERE objectId=?',
      [franchiseId]
    );
    expect(mockConnection.execute).toHaveBeenCalledWith(
      'DELETE FROM franchise WHERE id=?',
      [franchiseId]
    );
    
    expect(mockConnection.commit).toHaveBeenCalled();
    expect(mockConnection.end).toHaveBeenCalled();
  });
  
  test('deleteFranchise throws error if connection fails', async () => {
    const franchiseId = 1;

    mysql.createConnection.mockRejectedValueOnce(new Error('Connection failed'));
  
    try {
      await db.DB.deleteFranchise(franchiseId);
    } catch (error) {
      expect(error.message).toBe('Connection failed');
    }
  });

 
  test('createStore adds new store successfully', async () => {
    const franchiseId = 1;
    const store = {
      name: 'Test Store'
    };
    const mockInsertResult = { insertId: 1 };
    
    mockConnection.execute.mockResolvedValueOnce([mockInsertResult]);
  
    const result = await db.DB.createStore(franchiseId, store);
    
    expect(mockConnection.execute).toHaveBeenCalledWith(
      'INSERT INTO store (franchiseId, name) VALUES (?, ?)',
      [franchiseId, store.name]
    );
    expect(result).toEqual({
      id: 1,
      franchiseId: franchiseId,
      name: store.name
    });
    expect(mockConnection.end).toHaveBeenCalled();
  });
  test('deleteStore removes store successfully', async () => {
    const franchiseId = 1;
    const storeId = 1;
    
    mockConnection.execute.mockResolvedValueOnce([{}]);
  
    await db.DB.deleteStore(franchiseId, storeId);
    
    expect(mockConnection.execute).toHaveBeenCalledWith(
      'DELETE FROM store WHERE franchiseId=? AND id=?',
      [franchiseId, storeId]
    );
    expect(mockConnection.end).toHaveBeenCalled();
  });
  test('isLoggedIn returns true for valid token', async () => {
    const token = 'jwt.token.signature';
    mockConnection.execute.mockResolvedValueOnce([[{ userId: 1 }]]);
  
    const result = await db.DB.isLoggedIn(token);
    
    expect(mockConnection.execute).toHaveBeenCalledWith(
      'SELECT userId FROM auth WHERE token=?',
      ['signature']
    );
    expect(result).toBe(true);
    expect(mockConnection.end).toHaveBeenCalled();
  });

  test('isLoggedIn returns false for invalid token', async () => {
    const token = 'jwt.token.invalid';
    mockConnection.execute.mockResolvedValueOnce([[]]);
  
    const result = await db.DB.isLoggedIn(token);
    
    expect(mockConnection.execute).toHaveBeenCalledWith(
      'SELECT userId FROM auth WHERE token=?',
      ['invalid']
    );
    expect(result).toBe(false);
    expect(mockConnection.end).toHaveBeenCalled();
  });

  test('logoutUser removes auth token successfully', async () => {
    const token = 'jwt.token.signature';
    mockConnection.execute.mockResolvedValueOnce([{}]);
  
    await db.DB.logoutUser(token);
    
    expect(mockConnection.execute).toHaveBeenCalledWith(
      'DELETE FROM auth WHERE token=?',
      ['signature']
    );
    expect(mockConnection.end).toHaveBeenCalled();
  });
  test('getFranchises returns all franchises with stores for non-admin user', async () => {
    const mockFranchises = [
      { id: 1, name: 'Franchise 1' },
      { id: 2, name: 'Franchise 2' }
    ];
    const mockStores = [
      { id: 1, name: 'Store 1' },
      { id: 2, name: 'Store 2' }
    ];
  
    mockConnection.execute.mockResolvedValueOnce([mockFranchises]);
    mockConnection.execute
      .mockResolvedValueOnce([mockStores])
      .mockResolvedValueOnce([mockStores]);
  
    const result = await db.DB.getFranchises({ isRole: () => false });
  
    expect(mockConnection.execute).toHaveBeenCalledWith(
      'SELECT id, name FROM franchise',
      undefined
    );
    
    // Should query stores for each franchise
    mockFranchises.forEach(franchise => {
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'SELECT id, name FROM store WHERE franchiseId=?',
        [franchise.id]
      );
    });
  
    expect(result).toEqual(
      mockFranchises.map(franchise => ({
        ...franchise,
        stores: mockStores
      }))
    );
    expect(mockConnection.end).toHaveBeenCalled();
  });
  
  test('getFranchises returns detailed franchise info for admin user', async () => {
    const mockFranchises = [
      { id: 1, name: 'Franchise 1' },
      { id: 2, name: 'Franchise 2' }
    ];
    const mockAdmins = [
      { id: 1, name: 'Admin 1', email: 'admin1@test.com' }
    ];
    const mockStores = [
      { id: 1, name: 'Store 1', totalRevenue: 1000 }
    ];
  
    mockConnection.execute.mockResolvedValueOnce([mockFranchises]);
    mockConnection.execute
      .mockResolvedValueOnce([mockAdmins])
      .mockResolvedValueOnce([mockStores])
      .mockResolvedValueOnce([mockAdmins])
      .mockResolvedValueOnce([mockStores]);
  
    const result = await db.DB.getFranchises({ isRole: () => true });
  
    expect(mockConnection.execute).toHaveBeenCalledWith(
      'SELECT id, name FROM franchise',
      undefined
    );

    mockFranchises.forEach(franchise => {
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'SELECT u.id, u.name, u.email FROM userRole AS ur JOIN user AS u ON u.id=ur.userId WHERE ur.objectId=? AND ur.role=\'franchisee\'',
        [franchise.id]
      );
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'SELECT s.id, s.name, COALESCE(SUM(oi.price), 0) AS totalRevenue FROM dinerOrder AS do JOIN orderItem AS oi ON do.id=oi.orderId RIGHT JOIN store AS s ON s.id=do.storeId WHERE s.franchiseId=? GROUP BY s.id',
        [franchise.id]
      );
    });
  
    expect(result).toEqual(
      mockFranchises.map(franchise => ({
        ...franchise,
        admins: mockAdmins,
        stores: mockStores
      }))
    );
    expect(mockConnection.end).toHaveBeenCalled();
  });
  
  test('getUserFranchises returns empty array when user has no franchises', async () => {
    const userId = 1;
    mockConnection.execute.mockResolvedValueOnce([[]]);
  
    const result = await db.DB.getUserFranchises(userId);
  
    expect(mockConnection.execute).toHaveBeenCalledWith(
      'SELECT objectId FROM userRole WHERE role=\'franchisee\' AND userId=?',
      [userId]
    );
    expect(result).toEqual([]);
    expect(mockConnection.end).toHaveBeenCalled();
  });
});