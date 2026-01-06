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

const mockReportStore = {
  getTemplates: jest.fn(() => Promise.resolve([])),
  getRecentRuns: jest.fn(() => Promise.resolve([])),
  setRecentRuns: jest.fn(() => Promise.resolve([])),
  getSchedules: jest.fn(() => Promise.resolve([])),
  createSchedule: jest.fn(() => Promise.resolve(null)),
  updateSchedule: jest.fn(() => Promise.resolve(null)),
  patchSchedule: jest.fn(() => Promise.resolve(null)),
  deleteSchedule: jest.fn(() => Promise.resolve(true)),
};

jest.mock("../src/services/reportStore", () => mockReportStore);

const mockedDb = require("../src/db");
const mockedReportStore = require("../src/services/reportStore");
global.mockPool = mockedDb.pool;
global.mockConnection = mockConnection;
global.mockReportStore = mockedReportStore;

beforeEach(() => {
  mockPool.query.mockClear();
  mockPool.getConnection.mockClear();
  mockConnection.query.mockClear();
  mockConnection.beginTransaction.mockClear();
  mockConnection.commit.mockClear();
  mockConnection.rollback.mockClear();
  mockConnection.release.mockClear();
  Object.values(mockReportStore).forEach((fn) => {
    if (typeof fn === "function" && "mock" in fn) {
      fn.mockClear();
    }
  });
});

afterAll(() => {
  jest.resetModules();
});
