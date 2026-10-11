/** Nest injection token for the host PluginContributionRegistry */
export const PLUGIN_CONTRIBUTION_REGISTRY = 'PLUGIN_CONTRIBUTION_REGISTRY';

/**
 * Cross-cutting hooks plugins register via contribute().
 */

export interface RegisteredUserRef {
  id: string;
  email: string;
}

export interface RegistrationExtension {
  /** Run before user is created; throw to reject registration */
  validateRegister(body: Record<string, unknown>): Promise<void>;
  /** Run after user is saved */
  onUserRegistered?(
    user: RegisteredUserRef,
    body: Record<string, unknown>,
  ): Promise<void>;
}

export interface PluginContributionRegistry {
  addRegistrationExtension(extension: RegistrationExtension): void;
  getRegistrationExtensions(): RegistrationExtension[];
}

export class DefaultPluginContributionRegistry implements PluginContributionRegistry {
  private readonly registrationExtensions: RegistrationExtension[] = [];

  addRegistrationExtension(extension: RegistrationExtension): void {
    this.registrationExtensions.push(extension);
  }

  getRegistrationExtensions(): RegistrationExtension[] {
    return [...this.registrationExtensions];
  }
}
