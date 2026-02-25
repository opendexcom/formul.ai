import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let mockSettingsModel: any;

  beforeEach(() => {
    mockSettingsModel = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data: any) => ({
        ...data,
        save: jest.fn().mockResolvedValue(undefined),
      })),
    };

    service = new SettingsService(mockSettingsModel);
  });

  describe('getSettings', () => {
    it('creates default settings when none exist', async () => {
      const created = { allowRegistration: true };
      mockSettingsModel.create.mockReturnValue(created);

      const result = await service.getSettings();

      expect(mockSettingsModel.findOne).toHaveBeenCalled();
      expect(mockSettingsModel.create).toHaveBeenCalledWith({ allowRegistration: true });
      expect(result).toEqual(created);
    });

    it('returns existing settings when found', async () => {
      const existing = { allowRegistration: false };
      mockSettingsModel.findOne.mockResolvedValueOnce(existing);

      const result = await service.getSettings();

      expect(result).toBe(existing);
      expect(mockSettingsModel.create).not.toHaveBeenCalled();
    });
  });

  describe('updateRegistration', () => {
    it('creates settings with allowRegistration when none exist', async () => {
      const created = { allowRegistration: false };
      mockSettingsModel.create.mockReturnValue(created);

      const result = await service.updateRegistration(false);

      expect(mockSettingsModel.create).toHaveBeenCalledWith({ allowRegistration: false });
      expect(result).toEqual(created);
    });

    it('updates and saves existing settings', async () => {
      const existing = {
        allowRegistration: true,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockSettingsModel.findOne.mockResolvedValueOnce(existing);

      const result = await service.updateRegistration(false);

      expect(existing.allowRegistration).toBe(false);
      expect(existing.save).toHaveBeenCalled();
      expect(result).toBe(existing);
    });
  });

  describe('isRegistrationAllowed', () => {
    it('returns allowRegistration from getSettings', async () => {
      mockSettingsModel.findOne.mockResolvedValueOnce({ allowRegistration: true });

      const result = await service.isRegistrationAllowed();

      expect(result).toBe(true);
    });
  });
});
