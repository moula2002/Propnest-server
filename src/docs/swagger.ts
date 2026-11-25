export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Real Estate Platform REST API',
    version: '1.0.0',
    description: 'Enterprise Real Estate Platform Backend (99acres, NoBroker, MagicBricks architecture)',
    contact: {
      name: 'API Support Team',
      email: 'support@realestateplatform.com',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1 Current Base',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your JWT access token as `Bearer <token>`',
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'refreshToken',
        description: 'Automatic HttpOnly cookie session for token rotation',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Validation failed' },
          errors: { type: 'array', items: { type: 'object' } },
        },
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 100 },
          totalPages: { type: 'integer', example: 5 },
          hasNextPage: { type: 'boolean', example: true },
          hasPreviousPage: { type: 'boolean', example: false },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'System health check and database connectivity probe',
        tags: ['Health'],
        responses: {
          200: { description: 'System healthy' },
          503: { description: 'System degraded' },
        },
      },
    },
    '/auth/register': {
      post: {
        summary: 'Register new user or agent',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['fullName', 'email', 'password', 'confirmPassword'],
                properties: {
                  fullName: { type: 'string', example: 'Rahul Sharma' },
                  email: { type: 'string', format: 'email', example: 'rahul@example.com' },
                  phone: { type: 'string', example: '+919876543210' },
                  password: { type: 'string', example: 'SecurePass@123' },
                  confirmPassword: { type: 'string', example: 'SecurePass@123' },
                  role: { type: 'string', enum: ['USER', 'AGENT'], default: 'USER' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'User successfully registered' },
          400: { description: 'Validation error' },
          409: { description: 'Email already exists' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate credentials and obtain JWT access token',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'admin@realestateplatform.com' },
                  password: { type: 'string', example: 'AdminSecurePass@2026' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Authentication successful' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        summary: 'Rotate refresh token and obtain fresh access token',
        tags: ['Auth'],
        responses: {
          200: { description: 'Tokens rotated successfully' },
          401: { description: 'Invalid or revoked refresh session' },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Revoke current refresh session and clear cookie',
        tags: ['Auth'],
        responses: {
          200: { description: 'Logged out successfully' },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Retrieve authenticated profile',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Authenticated user profile' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/properties': {
      get: {
        summary: 'Public property discovery and search with multi-parameter filters',
        tags: ['Properties'],
        parameters: [
          { name: 'keyword', in: 'query', schema: { type: 'string' }, description: 'Search term' },
          { name: 'city', in: 'query', schema: { type: 'string' }, example: 'Bengaluru' },
          { name: 'locality', in: 'query', schema: { type: 'string' } },
          { name: 'listingType', in: 'query', schema: { type: 'string', enum: ['SALE', 'RENT', 'LEASE'] } },
          { name: 'propertyType', in: 'query', schema: { type: 'string', enum: ['APARTMENT', 'HOUSE', 'VILLA', 'PLOT', 'COMMERCIAL', 'OFFICE'] } },
          { name: 'minPrice', in: 'query', schema: { type: 'number' } },
          { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
          { name: 'bedrooms', in: 'query', schema: { type: 'integer' } },
          { name: 'furnishingStatus', in: 'query', schema: { type: 'string', enum: ['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED'] } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['newest', 'oldest', 'price_low_to_high', 'price_high_to_low', 'area_low_to_high', 'area_high_to_low'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          200: { description: 'Paginated properties retrieved' },
        },
      },
      post: {
        summary: 'Create new property listing (DRAFT)',
        tags: ['Properties'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'description', 'propertyType', 'listingType', 'price', 'carpetArea', 'city', 'locality', 'state', 'postalCode', 'address'],
                properties: {
                  title: { type: 'string', example: 'Sunny 2 BHK in Indiranagar' },
                  description: { type: 'string', example: 'Beautiful well lit flat close to metro station.' },
                  propertyType: { type: 'string', enum: ['APARTMENT', 'HOUSE', 'VILLA', 'PLOT', 'COMMERCIAL', 'OFFICE'] },
                  listingType: { type: 'string', enum: ['SALE', 'RENT', 'LEASE'] },
                  price: { type: 'number', example: 9500000 },
                  carpetArea: { type: 'number', example: 1100 },
                  bedrooms: { type: 'integer', example: 2 },
                  bathrooms: { type: 'integer', example: 2 },
                  city: { type: 'string', example: 'Bengaluru' },
                  locality: { type: 'string', example: 'Indiranagar' },
                  state: { type: 'string', example: 'Karnataka' },
                  postalCode: { type: 'string', example: '560038' },
                  address: { type: 'string', example: '12th Main Road' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Property listing created' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/properties/{id}': {
      get: {
        summary: 'Get property details by ID or slug',
        tags: ['Properties'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Property details with gallery and amenities' },
          404: { description: 'Property not found' },
        },
      },
      patch: {
        summary: 'Update property listing (Owner or Admin)',
        tags: ['Properties'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Property updated' },
          403: { description: 'Forbidden' },
        },
      },
      delete: {
        summary: 'Soft-delete property listing (Owner or Admin)',
        tags: ['Properties'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Property deleted' },
        },
      },
    },
    '/properties/{id}/inquiries': {
      post: {
        summary: 'Submit inquiry for property (Guest or Authenticated)',
        tags: ['Inquiries'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'phone', 'message'],
                properties: {
                  name: { type: 'string', example: 'Amit Kumar' },
                  email: { type: 'string', example: 'amit@example.com' },
                  phone: { type: 'string', example: '+919876500000' },
                  message: { type: 'string', example: 'I would like to schedule a site visit this Saturday.' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Inquiry submitted and owner notified' },
          429: { description: 'Rate limit or duplicate inquiry submission window' },
        },
      },
    },
    '/admin/dashboard': {
      get: {
        summary: 'System metrics and statistical breakdown',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Dashboard metrics' },
          403: { description: 'Admin access required' },
        },
      },
    },
    '/admin/auth/login': {
      post: {
        summary: 'Admin Portal Login (Restricted to ADMIN & SUPER_ADMIN)',
        tags: ['Admin Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'admin@realestateplatform.com' },
                  password: { type: 'string', example: 'AdminSecurePass@2026' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Admin successfully authenticated' },
          401: { description: 'Invalid credentials' },
          403: { description: 'Access denied: Admin privileges required' },
        },
      },
    },
    '/admin/dashboard/stats': {
      get: {
        summary: '13 live system database metric aggregations',
        tags: ['Admin Dashboard'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Dashboard stats' },
          403: { description: 'Forbidden' },
        },
      },
    },
    '/admin/dashboard/recent-activity': {
      get: {
        summary: 'Latest activity feed across users, properties, inquiries, and audit logs',
        tags: ['Admin Dashboard'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Recent activity feed' },
        },
      },
    },
    '/admin/users': {
      get: {
        summary: 'List users with pagination, search, and filters',
        tags: ['Admin Users'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Paginated user list' },
        },
      },
    },
    '/admin/users/{id}': {
      get: {
        summary: 'Get complete user profile with properties and inquiries',
        tags: ['Admin Users'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'User details' },
          404: { description: 'User not found' },
        },
      },
    },
    '/admin/users/{id}/status': {
      patch: {
        summary: 'Update account status (ACTIVE, SUSPENDED, DEACTIVATED)',
        tags: ['Admin Users'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Status updated' },
        },
      },
    },
    '/admin/properties/pending': {
      get: {
        summary: 'Retrieve properties awaiting moderation approval',
        tags: ['Admin Properties'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Pending approval properties' },
        },
      },
    },
    '/admin/properties/{id}/approve': {
      patch: {
        summary: 'Approve and publish property listing',
        tags: ['Admin Properties'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Property approved' },
        },
      },
    },
    '/admin/properties/{id}/reject': {
      patch: {
        summary: 'Reject property listing with required reason',
        tags: ['Admin Properties'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Property rejected' },
        },
      },
    },
    '/admin/inquiries': {
      get: {
        summary: 'List all buyer inquiries',
        tags: ['Admin Inquiries'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Inquiry list' },
        },
      },
    },
    '/admin/audit-logs': {
      get: {
        summary: 'Retrieve administrative audit trail',
        tags: ['Admin Audit Logs'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Audit trail records' },
        },
      },
    },
  },
};

