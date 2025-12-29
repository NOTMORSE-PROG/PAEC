import { createSwaggerSpec } from 'next-swagger-doc'

export const getApiDocs = () => {
  const spec = createSwaggerSpec({
    apiFolder: 'src/app/api',
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'ATC Readback ML API',
        version: '3.0.0',
        description: `
## Adaptive Machine Learning API for ATC Readback Analysis

This API provides:
- **Dynamic ML Analysis** - Analyzes ATC-pilot communications with adaptive learning
- **Real-time Learning** - Model improves from user corrections
- **Training Data Management** - Fetch from HuggingFace, manage corpus
- **Database Persistence** - PostgreSQL storage for model state

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
          name: 'Adaptive ML',
          description: 'Dynamic machine learning with real-time learning capabilities',
        },
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
        '/api/adaptive-ml': {
          get: {
            tags: ['Adaptive ML'],
            summary: 'Get Model State',
            description: 'Returns the current adaptive ML model state including weights, statistics, and learning history',
            responses: {
              '200': {
                description: 'Model state retrieved successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        model: {
                          type: 'object',
                          properties: {
                            version: { type: 'string', example: '3.0.0-adaptive' },
                            config: { type: 'object' },
                          },
                        },
                        stats: {
                          type: 'object',
                          properties: {
                            accuracy: { type: 'number', example: 0.85 },
                            totalInteractions: { type: 'integer', example: 150 },
                            recentAccuracy: { type: 'number', example: 0.9 },
                          },
                        },
                        weights: { type: 'object' },
                        history: { type: 'object' },
                      },
                    },
                  },
                },
              },
            },
          },
          post: {
            tags: ['Adaptive ML'],
            summary: 'Execute ML Actions',
            description: 'Perform various ML actions: analyze, correct, batchLearn, reinforce, config, reset, export, import',
            parameters: [
              {
                name: 'action',
                in: 'query',
                required: true,
                schema: {
                  type: 'string',
                  enum: ['analyze', 'correct', 'batchLearn', 'reinforce', 'config', 'reset', 'export', 'import'],
                },
                description: 'The action to perform',
              },
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    oneOf: [
                      {
                        title: 'Analyze Request',
                        type: 'object',
                        properties: {
                          atc: { type: 'string', example: 'PAL456 climb and maintain flight level two five zero' },
                          pilot: { type: 'string', example: 'Climbing two five zero PAL456' },
                          callsign: { type: 'string', example: 'PAL456' },
                        },
                        required: ['atc', 'pilot'],
                      },
                      {
                        title: 'Correct Request (Learning)',
                        type: 'object',
                        properties: {
                          original: {
                            type: 'object',
                            properties: {
                              atc: { type: 'string' },
                              pilot: { type: 'string' },
                              predictedCorrect: { type: 'boolean' },
                              predictedErrors: { type: 'array', items: { type: 'string' } },
                              predictedPhase: { type: 'string' },
                            },
                          },
                          corrected: {
                            type: 'object',
                            properties: {
                              isActuallyCorrect: { type: 'boolean' },
                              actualErrors: { type: 'array', items: { type: 'string' } },
                              actualPhase: { type: 'string' },
                              userFeedback: { type: 'string' },
                            },
                          },
                        },
                      },
                      {
                        title: 'Batch Learn Request',
                        type: 'object',
                        properties: {
                          examples: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                atc: { type: 'string' },
                                pilot: { type: 'string' },
                                isCorrect: { type: 'boolean' },
                                errors: { type: 'array', items: { type: 'string' } },
                              },
                            },
                          },
                        },
                      },
                      {
                        title: 'Reinforce Request',
                        type: 'object',
                        properties: {
                          totalReadbacks: { type: 'integer' },
                          correctReadbacks: { type: 'integer' },
                          commonErrors: { type: 'array', items: { type: 'string' } },
                          phases: { type: 'array', items: { type: 'string' } },
                        },
                      },
                      {
                        title: 'Config Request',
                        type: 'object',
                        properties: {
                          learningRate: { type: 'number', minimum: 0.01, maximum: 0.5 },
                          momentum: { type: 'number', minimum: 0, maximum: 0.9 },
                          minConfidence: { type: 'number' },
                          adaptiveRateEnabled: { type: 'boolean' },
                          reinforcementEnabled: { type: 'boolean' },
                        },
                      },
                    ],
                  },
                  examples: {
                    analyze: {
                      summary: 'Analyze a readback',
                      value: {
                        atc: 'PAL456 climb and maintain flight level two five zero',
                        pilot: 'Climbing two five zero PAL456',
                      },
                    },
                    correct: {
                      summary: 'Apply user correction (model learns)',
                      value: {
                        original: {
                          atc: 'Turn right heading 090',
                          pilot: 'Left heading 090',
                          predictedCorrect: true,
                          predictedErrors: [],
                          predictedPhase: 'cruise',
                        },
                        corrected: {
                          isActuallyCorrect: false,
                          actualErrors: ['wrong_direction'],
                          actualPhase: 'approach',
                        },
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Action completed successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        analysis: { type: 'object' },
                        weightUpdates: { type: 'array' },
                      },
                    },
                  },
                },
              },
              '400': {
                description: 'Invalid request',
              },
            },
          },
        },
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
              severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
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
