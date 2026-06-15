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
});