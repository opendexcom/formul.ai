import { AdminBootstrapService } from './admin-bootstrap.service';

describe('AdminBootstrapService', () => {
  let service: AdminBootstrapService;
  let mockUserModel: any;

  beforeEach(() => {
    mockUserModel = {
      findOne: jest.fn(),
      create: jest.fn(),
    };
    service = new AdminBootstrapService(mockUserModel);
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_FIRST_NAME;
    delete process.env.ADMIN_LAST_NAME;
  });

  it('does nothing when admin env vars are unset', async () => {
    await service.bootstrapAdminFromEnv();

    expect(mockUserModel.findOne).not.toHaveBeenCalled();
    expect(mockUserModel.create).not.toHaveBeenCalled();
  });

  it('throws when only one admin env var is set', async () => {
    process.env.ADMIN_EMAIL = 'admin@example.com';

    await expect(service.bootstrapAdminFromEnv()).rejects.toThrow(
      'Admin bootstrap requires both ADMIN_EMAIL and ADMIN_PASSWORD',
    );
  });

  it('throws when password is too weak', async () => {
    process.env.ADMIN_EMAIL = 'admin@example.com';
    process.env.ADMIN_PASSWORD = 'weak';

    await expect(service.bootstrapAdminFromEnv()).rejects.toThrow(
      'ADMIN_PASSWORD must be at least 8 characters',
    );
  });

  it('creates a verified admin user when none exists', async () => {
    process.env.ADMIN_EMAIL = 'Admin@Example.com';
    process.env.ADMIN_PASSWORD = 'SecureP@ss1';
    process.env.ADMIN_FIRST_NAME = 'Ada';
    process.env.ADMIN_LAST_NAME = 'Min';
    mockUserModel.findOne.mockResolvedValue(null);
    mockUserModel.create.mockResolvedValue({});

    await service.bootstrapAdminFromEnv();

    expect(mockUserModel.findOne).toHaveBeenCalledWith({
      email: 'admin@example.com',
    });
    expect(mockUserModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'admin@example.com',
        firstName: 'Ada',
        lastName: 'Min',
        roles: ['user', 'admin'],
        isEmailVerified: true,
        password: expect.any(String),
      }),
    );
  });

  it('promotes an existing user to admin without recreating', async () => {
    process.env.ADMIN_EMAIL = 'user@example.com';
    process.env.ADMIN_PASSWORD = 'SecureP@ss1';
    const existing = {
      email: 'user@example.com',
      roles: ['user'],
      isEmailVerified: false,
      emailVerificationToken: 'token',
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockUserModel.findOne.mockResolvedValue(existing);

    await service.bootstrapAdminFromEnv();

    expect(existing.roles).toEqual(['user', 'admin']);
    expect(existing.isEmailVerified).toBe(true);
    expect(existing.emailVerificationToken).toBeUndefined();
    expect(existing.save).toHaveBeenCalled();
    expect(mockUserModel.create).not.toHaveBeenCalled();
  });
});
