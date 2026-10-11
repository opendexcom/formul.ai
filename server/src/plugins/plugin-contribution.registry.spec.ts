import { DefaultPluginContributionRegistry } from '@opendexcom/plugin-interface';
import type { RegistrationExtension } from '@opendexcom/plugin-interface';

describe('DefaultPluginContributionRegistry', () => {
  it('collects registration extensions', async () => {
    const registry = new DefaultPluginContributionRegistry();
    const ext: RegistrationExtension = {
      validateRegister: jest.fn().mockResolvedValue(undefined),
    };
    registry.addRegistrationExtension(ext);

    expect(registry.getRegistrationExtensions()).toHaveLength(1);
    await registry.getRegistrationExtensions()[0].validateRegister({});
    expect(ext.validateRegister).toHaveBeenCalled();
  });
});
