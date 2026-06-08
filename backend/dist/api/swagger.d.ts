/**
 * OpenAPI 3.0 specification for the Airbrake Monitoring Portal API.
 * Served at GET /api/docs
 */
export declare const swaggerSpec: {
    openapi: string;
    info: {
        title: string;
        version: string;
        description: string;
    };
    servers: {
        url: string;
        description: string;
    }[];
    components: {
        securitySchemes: {
            ApiKeyAuth: {
                type: string;
                in: string;
                name: string;
                description: string;
            };
        };
        schemas: {
            Severity: {
                type: string;
                enum: string[];
            };
            Environment: {
                type: string;
                enum: string[];
            };
            BreakStatus: {
                type: string;
                enum: string[];
            };
            IngestLogRequest: {
                type: string;
                required: string[];
                properties: {
                    id: {
                        type: string;
                        format: string;
                        description: string;
                    };
                    applicationId: {
                        type: string;
                        example: string;
                    };
                    environment: {
                        $ref: string;
                    };
                    severity: {
                        $ref: string;
                    };
                    message: {
                        type: string;
                        example: string;
                    };
                    timestamp: {
                        type: string;
                        format: string;
                        description: string;
                    };
                    tags: {
                        type: string;
                        items: {
                            type: string;
                        };
                        example: string[];
                    };
                };
            };
            IngestLogResponse: {
                type: string;
                properties: {
                    id: {
                        type: string;
                        format: string;
                    };
                    status: {
                        type: string;
                        example: string;
                    };
                };
            };
            IngestErrorRequest: {
                type: string;
                required: string[];
                properties: {
                    id: {
                        type: string;
                        format: string;
                        description: string;
                    };
                    applicationId: {
                        type: string;
                        example: string;
                    };
                    environment: {
                        $ref: string;
                    };
                    severity: {
                        $ref: string;
                    };
                    errorMessage: {
                        type: string;
                        example: string;
                    };
                    stackTrace: {
                        type: string;
                        example: string;
                    };
                    endpoint: {
                        type: string;
                        nullable: boolean;
                        example: string;
                    };
                    requestPayload: {
                        type: string;
                        nullable: boolean;
                        additionalProperties: boolean;
                    };
                    userSession: {
                        type: string;
                        nullable: boolean;
                        additionalProperties: boolean;
                    };
                    timestamp: {
                        type: string;
                        format: string;
                        description: string;
                    };
                };
            };
            IngestErrorResponse: {
                type: string;
                properties: {
                    id: {
                        type: string;
                        format: string;
                    };
                    groupId: {
                        type: string;
                        format: string;
                    };
                    status: {
                        $ref: string;
                    };
                };
            };
            Break: {
                type: string;
                properties: {
                    id: {
                        type: string;
                    };
                    applicationId: {
                        type: string;
                    };
                    environment: {
                        type: string;
                    };
                    severity: {
                        $ref: string;
                    };
                    errorMessage: {
                        type: string;
                    };
                    stackTrace: {
                        type: string;
                    };
                    endpoint: {
                        type: string;
                        nullable: boolean;
                    };
                    requestPayload: {
                        type: string;
                        nullable: boolean;
                    };
                    userSession: {
                        type: string;
                        nullable: boolean;
                    };
                    timestamp: {
                        type: string;
                        format: string;
                    };
                    fingerprint: {
                        type: string;
                    };
                    status: {
                        $ref: string;
                    };
                    correlatedLogs: {
                        type: string;
                        items: {
                            $ref: string;
                        };
                    };
                };
            };
            BreaksPage: {
                type: string;
                properties: {
                    data: {
                        type: string;
                        items: {
                            $ref: string;
                        };
                    };
                    total: {
                        type: string;
                    };
                    page: {
                        type: string;
                    };
                    limit: {
                        type: string;
                    };
                };
            };
            LogRecord: {
                type: string;
                properties: {
                    id: {
                        type: string;
                    };
                    applicationId: {
                        type: string;
                    };
                    environment: {
                        $ref: string;
                    };
                    severity: {
                        $ref: string;
                    };
                    message: {
                        type: string;
                    };
                    timestamp: {
                        type: string;
                        format: string;
                    };
                    tags: {
                        type: string;
                        items: {
                            type: string;
                        };
                    };
                };
            };
            LogsPage: {
                type: string;
                properties: {
                    data: {
                        type: string;
                        items: {
                            $ref: string;
                        };
                    };
                    total: {
                        type: string;
                    };
                    page: {
                        type: string;
                    };
                    limit: {
                        type: string;
                    };
                };
            };
            AlertRule: {
                type: string;
                properties: {
                    id: {
                        type: string;
                    };
                    name: {
                        type: string;
                    };
                    threshold: {
                        type: string;
                    };
                    windowSeconds: {
                        type: string;
                    };
                    triggerOnNewError: {
                        type: string;
                    };
                    enabled: {
                        type: string;
                    };
                    createdBy: {
                        type: string;
                    };
                };
            };
            ErrorResponse: {
                type: string;
                properties: {
                    error: {
                        type: string;
                    };
                    message: {
                        type: string;
                    };
                };
            };
        };
    };
    paths: {
        '/api/health': {
            get: {
                tags: string[];
                summary: string;
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        status: {
                                            type: string;
                                            example: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/api/ingest/logs': {
            post: {
                tags: string[];
                summary: string;
                description: string;
                security: {
                    ApiKeyAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    202: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    400: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    401: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/api/ingest/errors': {
            post: {
                tags: string[];
                summary: string;
                description: string;
                security: {
                    ApiKeyAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    202: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    400: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    401: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/api/breaks': {
            get: {
                tags: string[];
                summary: string;
                parameters: ({
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        default: number;
                        maximum?: undefined;
                        enum?: undefined;
                        $ref?: undefined;
                        format?: undefined;
                    };
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        default: number;
                        maximum: number;
                        enum?: undefined;
                        $ref?: undefined;
                        format?: undefined;
                    };
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        enum: string[];
                        default?: undefined;
                        maximum?: undefined;
                        $ref?: undefined;
                        format?: undefined;
                    };
                } | {
                    name: string;
                    in: string;
                    schema: {
                        $ref: string;
                        type?: undefined;
                        default?: undefined;
                        maximum?: undefined;
                        enum?: undefined;
                        format?: undefined;
                    };
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        default?: undefined;
                        maximum?: undefined;
                        enum?: undefined;
                        $ref?: undefined;
                        format?: undefined;
                    };
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        format: string;
                        default?: undefined;
                        maximum?: undefined;
                        enum?: undefined;
                        $ref?: undefined;
                    };
                })[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/api/breaks/export': {
            get: {
                tags: string[];
                summary: string;
                parameters: ({
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        enum: string[];
                        default: string;
                        $ref?: undefined;
                        format?: undefined;
                    };
                } | {
                    name: string;
                    in: string;
                    schema: {
                        $ref: string;
                        type?: undefined;
                        enum?: undefined;
                        default?: undefined;
                        format?: undefined;
                    };
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        enum?: undefined;
                        default?: undefined;
                        $ref?: undefined;
                        format?: undefined;
                    };
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        format: string;
                        enum?: undefined;
                        default?: undefined;
                        $ref?: undefined;
                    };
                })[];
                responses: {
                    200: {
                        description: string;
                    };
                };
            };
        };
        '/api/breaks/{id}': {
            get: {
                tags: string[];
                summary: string;
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    404: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/api/logs': {
            get: {
                tags: string[];
                summary: string;
                parameters: ({
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        default: number;
                        maximum?: undefined;
                        $ref?: undefined;
                        format?: undefined;
                    };
                    description?: undefined;
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        default: number;
                        maximum: number;
                        $ref?: undefined;
                        format?: undefined;
                    };
                    description?: undefined;
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        default?: undefined;
                        maximum?: undefined;
                        $ref?: undefined;
                        format?: undefined;
                    };
                    description?: undefined;
                } | {
                    name: string;
                    in: string;
                    schema: {
                        $ref: string;
                        type?: undefined;
                        default?: undefined;
                        maximum?: undefined;
                        format?: undefined;
                    };
                    description?: undefined;
                } | {
                    name: string;
                    in: string;
                    description: string;
                    schema: {
                        type: string;
                        default?: undefined;
                        maximum?: undefined;
                        $ref?: undefined;
                        format?: undefined;
                    };
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        format: string;
                        default?: undefined;
                        maximum?: undefined;
                        $ref?: undefined;
                    };
                    description?: undefined;
                })[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/api/logs/export': {
            get: {
                tags: string[];
                summary: string;
                parameters: ({
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        enum: string[];
                        default: string;
                        $ref?: undefined;
                        format?: undefined;
                    };
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        enum?: undefined;
                        default?: undefined;
                        $ref?: undefined;
                        format?: undefined;
                    };
                } | {
                    name: string;
                    in: string;
                    schema: {
                        $ref: string;
                        type?: undefined;
                        enum?: undefined;
                        default?: undefined;
                        format?: undefined;
                    };
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        format: string;
                        enum?: undefined;
                        default?: undefined;
                        $ref?: undefined;
                    };
                })[];
                responses: {
                    200: {
                        description: string;
                    };
                };
            };
        };
        '/api/dashboard': {
            get: {
                tags: string[];
                summary: string;
                responses: {
                    200: {
                        description: string;
                    };
                };
            };
        };
        '/api/alerts': {
            get: {
                tags: string[];
                summary: string;
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    items: {
                                        $ref: string;
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/api/users': {
            get: {
                tags: string[];
                summary: string;
                responses: {
                    200: {
                        description: string;
                    };
                };
            };
        };
        '/api/retention': {
            get: {
                tags: string[];
                summary: string;
                responses: {
                    200: {
                        description: string;
                    };
                };
            };
        };
    };
};
