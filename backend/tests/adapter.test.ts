import { AIAdapter } from '../src/ai/adapter'; // Adjust path if necessary
import { LocalEngine } from '../src/ai/engines/local'; // Adjust path if necessary

// Mocking the engine to isolate tests
jest.mock('../src/ai/engines/local');

describe('AIAdapter Strategy Pattern (US-10)', () => {
  it('should pass natural language and schema to the injected engine and return a valid result', async () => {
    // 1. Arrange
    const mockNl = 'Show me total sales';
    const mockSchemaSdl = 'type Query { sales: Int }';
    const mockChartConfig = {
        chartType: 'bar',
        data: []
    };

    const mockEngine = new LocalEngine();
    mockEngine.resolve = jest.fn().mockResolvedValue(mockChartConfig);

    const adapter = new AIAdapter(mockEngine);

    // 2. Act
    const result = await adapter.resolve({ nl: mockNl }, mockSchemaSdl);

    // 3. Assert
    expect(mockEngine.resolve).toHaveBeenCalledTimes(1);
    expect(mockEngine.resolve).toHaveBeenCalledWith(mockNl, mockSchemaSdl);
    expect(result).toEqual({
      chartConfig: mockChartConfig,
      fromCache: false,
      engine: "local",
    });
  });

  it('should return cached result within TTL without calling the engine again', async () => {
  const mockNl = 'Show me total sales';
  const mockSchemaSdl = 'type Query { sales: Int }';
  const mockChartConfig = {
    chartType: 'bar',
    data: [],
  };

  const mockEngine = new LocalEngine();
  mockEngine.resolve = jest.fn().mockResolvedValue(mockChartConfig);

  const adapter = new AIAdapter(mockEngine, 'local', 600000);

  const firstResult = await adapter.resolve({ nl: mockNl }, mockSchemaSdl);
  const secondResult = await adapter.resolve({ nl: mockNl }, mockSchemaSdl);

  expect(mockEngine.resolve).toHaveBeenCalledTimes(1);
  expect(firstResult.fromCache).toBe(false);
  expect(secondResult.fromCache).toBe(true);
  expect(secondResult.chartConfig).toEqual(mockChartConfig);
  });

  it('should refresh the cache after TTL expires', async () => {
    const mockNl = 'Show me total sales';
    const mockSchemaSdl = 'type Query { sales: Int }';

    const firstChartConfig = {
      chartType: 'bar',
      data: [{ value: 1 }],
    };

    const secondChartConfig = {
      chartType: 'bar',
      data: [{ value: 2 }],
    };

    const mockEngine = new LocalEngine();
    mockEngine.resolve = jest.fn()
      .mockResolvedValueOnce(firstChartConfig)
      .mockResolvedValueOnce(secondChartConfig);

    const adapter = new AIAdapter(mockEngine, 'local', 1);

    const firstResult = await adapter.resolve({ nl: mockNl }, mockSchemaSdl);

    await new Promise((resolve) => setTimeout(resolve, 5));

    const secondResult = await adapter.resolve({ nl: mockNl }, mockSchemaSdl);

    expect(mockEngine.resolve).toHaveBeenCalledTimes(2);
    expect(firstResult.fromCache).toBe(false);
    expect(secondResult.fromCache).toBe(false);
    expect(secondResult.chartConfig).toEqual(secondChartConfig);
  });

  it('should make a fresh call after cache is cleared manually', async () => {
    const mockNl = 'Show me total sales';
    const mockSchemaSdl = 'type Query { sales: Int }';

    const firstChartConfig = {
      chartType: 'bar',
      data: [{ value: 1 }],
    };

    const secondChartConfig = {
      chartType: 'bar',
      data: [{ value: 2 }],
    };

    const mockEngine = new LocalEngine();
    mockEngine.resolve = jest.fn()
      .mockResolvedValueOnce(firstChartConfig)
      .mockResolvedValueOnce(secondChartConfig);

    const adapter = new AIAdapter(mockEngine, 'local', 600000);

    await adapter.resolve({ nl: mockNl }, mockSchemaSdl);
    adapter.clearCache();
    const secondResult = await adapter.resolve({ nl: mockNl }, mockSchemaSdl);

    expect(mockEngine.resolve).toHaveBeenCalledTimes(2);
    expect(secondResult.fromCache).toBe(false);
    expect(secondResult.chartConfig).toEqual(secondChartConfig);
  });
});

