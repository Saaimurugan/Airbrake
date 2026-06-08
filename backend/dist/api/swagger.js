"use strict";
/**
 * OpenAPI 3.0 specification for the Airbrake Monitoring Portal API.
 * Served at GET /api/docs
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.swaggerSpec = void 0;
exports.swaggerSpec = {
    openapi: '3.0.0',
    info: {
        title: 'Airbrake Monitoring Portal API',
        version: '1.0.0',
        description: 'REST API for ingesting logs and errors, querying breaks, managing alerts, and exporting data.',
    },
    servers: [
        {
            url: 'https://l7xnpjosjvyrlx55dxrwdvx5g40okeyd.lambda-url.us-east-1.on.aws',
            description: 'Production — AWS Lambda Function URL',
        },
        {
            url: 'http://localhost:3001',
            description: 'Local dev server',
        },
    ],
    components: {
        securitySchemes: {
            ApiKeyAuth: {
                type: 'apiKey',
                in: 'header',
                name: 'X-API-Key',
                description: 'Required for ingest endpoints when INGEST_API_KEY env var is set.',
            },
        },
        schemas: {
            // ── Enums ──────────────────────────────────────────────────────────────
            Severity: {
                type: 'string',
                enum: ['info', 'warning', 'error', 'critical'],
            },
            Environment: {
                type: 'string',
                enum: ['production', 'qa', 'development'],
            },
            BreakStatus: {
                type: 'string',
                enum: ['new', 'existing', 'regression'],
            },
            // ── Ingest ─────────────────────────────────────────────────────────────
            IngestLogRequest: {
                type: 'object',
                required: ['applicationId', 'environment', 'severity', 'message'],
                properties: {
                    id: { type: 'string', format: 'uuid', description: 'Auto-generated if omitted.' },
                    applicationId: { type: 'string', example: 'api-gateway' },
                    environment: { $ref: '#/components/schemas/Environment' },
                    severity: { $ref: '#/components/schemas/Severity' },
                    message: { type: 'string', example: 'Database connection timed out' },
                    timestamp: { type: 'string', format: 'date-time', description: 'Defaults to now if omitted.' },
                    tags: { type: 'array', items: { type: 'string' }, example: ['db', 'timeout'] },
                },
            },
            IngestLogResponse: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    status: { type: 'string', example: 'accepted' },
                },
            },
            IngestErrorRequest: {
                type: 'object',
                required: ['applicationId', 'environment', 'severity', 'errorMessage', 'stackTrace'],
                properties: {
                    id: { type: 'string', format: 'uuid', description: 'Auto-generated if omitted.' },
                    applicationId: { type: 'string', example: 'payment-service' },
                    environment: { $ref: '#/components/schemas/Environment' },
                    severity: { $ref: '#/components/schemas/Severity' },
                    errorMessage: { type: 'string', example: "TypeError: Cannot read property 'id' of undefined" },
                    stackTrace: { type: 'string', example: 'at UserController.get (user.ts:42)\n  at Router.handle (router.ts:88)' },
                    endpoint: { type: 'string', nullable: true, example: '/api/users/123' },
                    requestPayload: { type: 'object', nullable: true, additionalProperties: true },
                    userSession: { type: 'object', nullable: true, additionalProperties: true },
                    timestamp: { type: 'string', format: 'date-time', description: 'Defaults to now if omitted.' },
                },
            },
            IngestErrorResponse: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    groupId: { type: 'string', format: 'uuid' },
                    status: { $ref: '#/components/schemas/BreakStatus' },
                },
            },
            // ── Breaks ─────────────────────────────────────────────────────────────
            Break: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    applicationId: { type: 'string' },
                    environment: { type: 'string' },
                    severity: { $ref: '#/components/schemas/Severity' },
                    errorMessage: { type: 'string' },
                    stackTrace: { type: 'string' },
                    endpoint: { type: 'string', nullable: true },
                    requestPayload: { type: 'object', nullable: true },
                    userSession: { type: 'object', nullable: true },
                    timestamp: { type: 'string', format: 'date-time' },
                    fingerprint: { type: 'string' },
                    status: { $ref: '#/components/schemas/BreakStatus' },
                    correlatedLogs: { type: 'array', items: { $ref: '#/components/schemas/LogRecord' } },
                },
            },
            BreaksPage: {
                type: 'object',
                properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Break' } },
                    total: { type: 'integer' },
                    page: { type: 'integer' },
                    limit: { type: 'integer' },
                },
            },
            // ── Logs ───────────────────────────────────────────────────────────────
            LogRecord: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    applicationId: { type: 'string' },
                    environment: { $ref: '#/components/schemas/Environment' },
                    severity: { $ref: '#/components/schemas/Severity' },
                    message: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                    tags: { type: 'array', items: { type: 'string' } },
                },
            },
            LogsPage: {
                type: 'object',
                properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/LogRecord' } },
                    total: { type: 'integer' },
                    page: { type: 'integer' },
                    limit: { type: 'integer' },
                },
            },
            // ── Alerts ─────────────────────────────────────────────────────────────
            AlertRule: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    threshold: { type: 'integer' },
                    windowSeconds: { type: 'integer' },
                    triggerOnNewError: { type: 'boolean' },
                    enabled: { type: 'boolean' },
                    createdBy: { type: 'string' },
                },
            },
            // ── Errors ─────────────────────────────────────────────────────────────
            ErrorResponse: {
                type: 'object',
                properties: {
                    error: { type: 'string' },
                    message: { type: 'string' },
                },
            },
        },
    },
    paths: {
        // ── Health ──────────────────────────────────────────────────────────────
        '/api/health': {
            get: {
                tags: ['System'],
                summary: 'Health check',
                responses: {
                    200: { description: 'Service is healthy', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' } } } } } },
                },
            },
        },
        // ── Ingest ──────────────────────────────────────────────────────────────
        '/api/ingest/logs': {
            post: {
                tags: ['Ingest'],
                summary: 'Report a log entry',
                description: 'Ingests a single log record into the pipeline. Publishes to Redis and indexes in Elasticsearch.',
                security: [{ ApiKeyAuth: [] }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/IngestLogRequest' } } },
                },
                responses: {
                    202: { description: 'Accepted', content: { 'application/json': { schema: { $ref: '#/components/schemas/IngestLogResponse' } } } },
                    400: { description: 'Invalid payload', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    401: { description: 'Missing or invalid API key', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                },
            },
        },
        '/api/ingest/errors': {
            post: {
                tags: ['Ingest'],
                summary: 'Report an error / break',
                description: 'Ingests an error, computes a fingerprint, and runs it through the aggregator to detect new/existing/regression status.',
                security: [{ ApiKeyAuth: [] }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/IngestErrorRequest' } } },
                },
                responses: {
                    202: { description: 'Accepted', content: { 'application/json': { schema: { $ref: '#/components/schemas/IngestErrorResponse' } } } },
                    400: { description: 'Invalid payload', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    401: { description: 'Missing or invalid API key', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                },
            },
        },
        // ── Breaks ──────────────────────────────────────────────────────────────
        '/api/breaks': {
            get: {
                tags: ['Breaks'],
                summary: 'List breaks (paginated)',
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
                    { name: 'status', in: 'query', schema: { type: 'string', enum: ['new', 'existing', 'regression'] } },
                    { name: 'severity', in: 'query', schema: { $ref: '#/components/schemas/Severity' } },
                    { name: 'applicationId', in: 'query', schema: { type: 'string' } },
                    { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
                    { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
                ],
                responses: {
                    200: { description: 'Paginated breaks', content: { 'application/json': { schema: { $ref: '#/components/schemas/BreaksPage' } } } },
                },
            },
        },
        '/api/breaks/export': {
            get: {
                tags: ['Breaks'],
                summary: 'Export breaks as JSON or CSV',
                parameters: [
                    { name: 'format', in: 'query', schema: { type: 'string', enum: ['json', 'csv'], default: 'json' } },
                    { name: 'severity', in: 'query', schema: { $ref: '#/components/schemas/Severity' } },
                    { name: 'applicationId', in: 'query', schema: { type: 'string' } },
                    { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
                    { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
                ],
                responses: {
                    200: { description: 'Exported data (JSON array or CSV file)' },
                },
            },
        },
        '/api/breaks/{id}': {
            get: {
                tags: ['Breaks'],
                summary: 'Get break detail with correlated logs',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: {
                    200: { description: 'Break detail', content: { 'application/json': { schema: { $ref: '#/components/schemas/Break' } } } },
                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                },
            },
        },
        // ── Logs ────────────────────────────────────────────────────────────────
        '/api/logs': {
            get: {
                tags: ['Logs'],
                summary: 'Search logs (paginated)',
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
                    { name: 'keyword', in: 'query', schema: { type: 'string' } },
                    { name: 'severity', in: 'query', schema: { $ref: '#/components/schemas/Severity' } },
                    { name: 'applicationId', in: 'query', schema: { type: 'string' } },
                    { name: 'environment', in: 'query', schema: { $ref: '#/components/schemas/Environment' } },
                    { name: 'tags', in: 'query', description: 'Comma-separated list', schema: { type: 'string' } },
                    { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
                    { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
                ],
                responses: {
                    200: { description: 'Paginated logs', content: { 'application/json': { schema: { $ref: '#/components/schemas/LogsPage' } } } },
                },
            },
        },
        '/api/logs/export': {
            get: {
                tags: ['Logs'],
                summary: 'Export logs as JSON or CSV',
                parameters: [
                    { name: 'format', in: 'query', schema: { type: 'string', enum: ['json', 'csv'], default: 'json' } },
                    { name: 'keyword', in: 'query', schema: { type: 'string' } },
                    { name: 'severity', in: 'query', schema: { $ref: '#/components/schemas/Severity' } },
                    { name: 'applicationId', in: 'query', schema: { type: 'string' } },
                    { name: 'environment', in: 'query', schema: { $ref: '#/components/schemas/Environment' } },
                    { name: 'tags', in: 'query', schema: { type: 'string' } },
                    { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
                    { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
                ],
                responses: {
                    200: { description: 'Exported data (JSON array or CSV file)' },
                },
            },
        },
        // ── Dashboard ───────────────────────────────────────────────────────────
        '/api/dashboard': {
            get: {
                tags: ['Dashboard'],
                summary: 'Get dashboard aggregation data',
                responses: {
                    200: { description: 'Dashboard metrics including break counts, error rate trend, top services, time series, severity breakdown, and deployment events' },
                },
            },
        },
        // ── Alerts ──────────────────────────────────────────────────────────────
        '/api/alerts': {
            get: {
                tags: ['Alerts'],
                summary: 'List alert rules',
                responses: {
                    200: { description: 'Array of alert rules', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/AlertRule' } } } } },
                },
            },
        },
        // ── Admin ───────────────────────────────────────────────────────────────
        '/api/users': {
            get: {
                tags: ['Admin'],
                summary: 'List users (admin only)',
                responses: {
                    200: { description: 'Array of users' },
                },
            },
        },
        '/api/retention': {
            get: {
                tags: ['Admin'],
                summary: 'Get retention policy',
                responses: {
                    200: { description: 'Retention policy object' },
                },
            },
        },
    },
};
//# sourceMappingURL=swagger.js.map