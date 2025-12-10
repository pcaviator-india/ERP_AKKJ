process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const createMockConnection = () => ({
  query: jest.fn(() => Promise.resolve([[]])),
  beginTransaction: jest.fn(() => Promise.resolve()),
  commit: jest.fn(() => Promise.resolve()),
  rollback: jest.fn(() => Promise.resolve()),
  release: jest.fn(() => Promise.resolve()),
});

const mockConnection = createMockConnection();
const mockPool = {
  query: jest.fn(() => Promise.resolve([[]])),
  getConnection: jest.fn(() => Promise.resolve(mockConnection)),
};

jest.mock("../src/db", () => ({
  pool: mockPool,
}));

const mockedDb = require("../src/db");
global.mockPool = mockedDb.pool;
global.mockConnection = mockConnection;

beforeEach(() => {
  mockPool.query.mockClear();
  mockPool.getConnection.mockClear();
  mockConnection.query.mockClear();
  mockConnection.beginTransaction.mockClear();
  mockConnection.commit.mockClear();
  mockConnection.rollback.mockClear();
  mockConnection.release.mockClear();
});

afterAll(() => {
  jest.resetModules();
});
