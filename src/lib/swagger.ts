import { createSwaggerSpec } from 'next-swagger-doc'

export const getApiDocs = () => {
  const spec = createSwaggerSpec({
    apiFolder: 'src/app/api',
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'ATC Readback Analysis API',
        version: '4.0.0',
        description: `
## ATC Readback Analysis API

This API provides:
- **Readback Analysis** - Analyzes ATC-pilot communications using rule-based engine
- **Training Data Management** - Fetch from HuggingFace, manage corpus
- **Database Persistence** - PostgreSQL storage for training corpus and model weights

### Authentication
Currently no authentication required (development mode).

### Base URL
\`http://localhost:3000/api\`
        `,
        contact: {
          name: 'ATC Readback ML',
          email: 'support@example.com',
        },
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development Server',
        },
      ],
      tags: [
        {
          name: 'Training',
          description: 'Training corpus management and HuggingFace integration',
        },
        {
          name: 'Database',
          description: 'PostgreSQL database operations',
        },
      ],
      paths: {
        '/api/training': {
          get: {
            tags: ['Training'],
            summary: 'Get Training Data',
            description: 'Retrieve training corpus and statistics',
            parameters: [
              {
                name: 'phase',
                in: 'query',
                schema: { type: 'string' },
                description: 'Filter by flight phase',
              },
              {
                name: 'type',
                in: 'query',
                schema: { type: 'string' },
                description: 'Filter by error type',
              },
              {
                name: 'correct',
                in: 'query',
                schema: { type: 'boolean' },
                description: 'Filter only correct examples',
              },
              {
                name: 'incorrect',
                in: 'query',
                schema: { type: 'boolean' },
                description: 'Filter only incorrect examples',
              },
            ],
            responses: {
              '200': {
                description: 'Training data retrieved',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        data: {
                          type: 'object',
                          properties: {
                            corpus: { type: 'array' },
                            stats: {
                              type: 'object',
                              properties: {
                                total: { type: 'integer' },
                                correct: { type: 'integer' },
                                incorrect: { type: 'integer' },
                                accuracy: { type: 'number' },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          post: {
            tags: ['Training'],
            summary: 'Training Actions',
            description: 'Add examples, analyze, train, or fetch from HuggingFace',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      action: {
                        type: 'string',
                        enum: ['add', 'addPhrase', 'addCallsign', 'addWaypoint', 'addProcedure', 'analyze', 'train', 'extensiveTraining', 'fetchFromHuggingFace'],
                      },
                    },
                    required: ['action'],
                  },
                  examples: {
                    fetchHuggingFace: {
                      summary: 'Fetch from HuggingFace',
                      value: {
                        action: 'fetchFromHuggingFace',
                        dataset: 'jacktol/atc-dataset',
                        limit: 100,
                        addToCorpus: true,
                      },
                    },
                    extensiveTraining: {
                      summary: 'Run extensive training',
                      value: {
                        action: 'extensiveTraining',
                        batches: 10,
                        dataset: 'jacktol/atc-dataset',
                      },
                    },
                    addExample: {
                      summary: 'Add training example',
                      value: {
                        action: 'add',
                        example: {
                          atc: 'PAL456 descend FL120',
                          pilot: 'Descending FL120 PAL456',
                          isCorrect: true,
                          phase: 'descent',
                        },
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Action completed',
              },
            },
          },
          delete: {
            tags: ['Training'],
            summary: 'Clear Training Data',
            parameters: [
              {
                name: 'target',
                in: 'query',
                schema: {
                  type: 'string',
                  enum: ['corpus', 'all'],
                  default: 'corpus',
                },
              },
            ],
            responses: {
              '200': {
                description: 'Data cleared',
              },
            },
          },
        },
        '/api/database': {
          get: {
            tags: ['Database'],
            summary: 'Get Database Stats',
            description: 'Get PostgreSQL connection status and statistics',
            responses: {
              '200': {
                description: 'Database stats retrieved',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        database: {
                          type: 'object',
                          properties: {
                            connected: { type: 'boolean' },
                            provider: { type: 'string', example: 'Neon PostgreSQL' },
                          },
                        },
                        corpus: { type: 'object' },
                        model: { type: 'object' },
                      },
                    },
                  },
                },
              },
            },
          },
          post: {
            tags: ['Database'],
            summary: 'Database Actions',
            parameters: [
              {
                name: 'action',
                in: 'query',
                required: true,
                schema: {
                  type: 'string',
                  enum: ['init', 'sync', 'load', 'importCorpus', 'getCorpus', 'clearCorpus'],
                },
              },
            ],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                  },
                  examples: {
                    init: {
                      summary: 'Initialize database',
                      value: {},
                    },
                    importCorpus: {
                      summary: 'Import training examples',
                      value: {
                        examples: [
                          { atc: 'Climb FL250', pilot: 'Climbing FL250', isCorrect: true, phase: 'climb' },
                        ],
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Action completed',
              },
            },
          },
        },
      },
      components: {
        schemas: {
          ATCTrainingExample: {
            type: 'object',
            properties: {
              atc: { type: 'string', description: 'ATC instruction' },
              pilot: { type: 'string', description: 'Pilot readback' },
              isCorrect: { type: 'boolean', description: 'Whether readback is correct' },
              phase: { type: 'string', description: 'Flight phase' },
              errorType: { type: 'string', description: 'Type of error if incorrect' },
              explanation: { type: 'string', description: 'Explanation of error' },
            },
          },
          AnalysisResult: {
            type: 'object',
            properties: {
              isCorrect: { type: 'boolean' },
              confidence: { type: 'number' },
              phase: { type: 'string' },
              phaseConfidence: { type: 'number' },
              errors: { type: 'array', items: { type: 'object' } },
              weight: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
              suggestions: { type: 'array', items: { type: 'string' } },
            },
          },
          WeightUpdate: {
            type: 'object',
            properties: {
              timestamp: { type: 'integer' },
              pattern: { type: 'string' },
              oldWeight: { type: 'number' },
              newWeight: { type: 'number' },
              reason: { type: 'string' },
              learningRate: { type: 'number' },
            },
          },
        },
      },
    },
  })
  return spec
}
