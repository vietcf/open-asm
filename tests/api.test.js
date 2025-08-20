const request = require('supertest');
const app = require('../src/app'); // Import your Express app

describe('API Tests with JWT', () => {
  let authToken = '';
  
  // Login và lấy token trước khi chạy tests
  beforeAll(async () => {
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        username: 'admin',
        password: 'admin123'
      });
    
    expect(loginResponse.status).toBe(200);
    authToken = loginResponse.body.token;
  });

  describe('Servers API', () => {
    test('GET /api/servers - should return servers list', async () => {
      const response = await request(app)
        .get('/api/servers?page=1&pageSize=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('GET /api/servers/:id - should return server detail', async () => {
      const response = await request(app)
        .get('/api/servers/1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toBe(1);
    });

    test('POST /api/servers - should create new server', async () => {
      const newServer = {
        name: 'Test Server via Jest',
        os: 1,
        status: 'active',
        location: 'Data Center 1',
        type: 'physical',
        description: 'Created via automated test'
      };

      const response = await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newServer)
        .expect(201);
      
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(newServer.name);
    });

    test('PUT /api/servers/:id - should update server', async () => {
      const updateData = {
        name: 'Updated Server Name',
        status: 'maintenance'
      };

      const response = await request(app)
        .put('/api/servers/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);
      
      expect(response.body.name).toBe(updateData.name);
    });

    test('DELETE /api/servers/:id - should delete server', async () => {
      await request(app)
        .delete('/api/servers/1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });
  });

  describe('Search & Filtering', () => {
    test('Search servers by IP address', async () => {
      const response = await request(app)
        .get('/api/servers?search=192.168.1.1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('data');
    });

    test('Filter servers by status', async () => {
      const response = await request(app)
        .get('/api/servers?status=active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('Authentication Tests', () => {
    test('Should reject requests without token', async () => {
      await request(app)
        .get('/api/servers')
        .expect(401);
    });

    test('Should reject requests with invalid token', async () => {
      await request(app)
        .get('/api/servers')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
