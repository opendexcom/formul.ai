/**
 * Utility functions for handling the "other" option with special identifier
 * The "other" option is marked with a special prefix to identify it regardless of position
 */

const OTHER_OPTION_PREFIX = '__OTHER__:';

/**
 * Migrates options array to use the special identifier for the "other" option
 * This handles backward compatibility for forms created before the identifier was added
 */
export function migrateOptionsForOther(options: string[] | undefined, canBeOther: boolean): string[] {
  if (!options || options.length === 0) {
    return options || [];
  }

  // If canBeOther is enabled but no option has the prefix, mark the last one
  if (canBeOther) {
    const hasOtherOption = options.some(opt => isOtherOption(opt));
    if (!hasOtherOption && options.length > 0) {
      const migrated = [...options];
      const lastIndex = migrated.length - 1;
      migrated[lastIndex] = markAsOtherOption(migrated[lastIndex]);
      return migrated;
    }
  }

  return options;
}

/**
 * Migrates a question to ensure the "other" option has the special prefix
 * This is called when loading forms from the backend
 */
export function migrateQuestionForOther(question: any): any {
  if (!question.options || question.options.length === 0) {
    return question;
  }

  // Check if any option has the prefix
  const hasOtherOption = question.options.some((opt: string) => isOtherOption(opt));
  
  // If canBeOther is true but no option has the prefix, mark the last option
  if (question.canBeOther && !hasOtherOption) {
    const migratedOptions = [...question.options];
    const lastIndex = migratedOptions.length - 1;
    migratedOptions[lastIndex] = markAsOtherOption(migratedOptions[lastIndex]);
    return { ...question, options: migratedOptions };
  }
  
  // If an option has the prefix but canBeOther is false, set canBeOther to true
  if (hasOtherOption && !question.canBeOther) {
    return { ...question, canBeOther: true };
  }
  
  return question;
}

/**
 * Checks if an option is the "other" option by checking for the special prefix
 */
export function isOtherOption(option: string): boolean {
  return option.startsWith(OTHER_OPTION_PREFIX);
}

/**
 * Gets the display label for an option (strips the special prefix if present)
 */
export function getOptionLabel(option: string): string {
  if (isOtherOption(option)) {
    return option.substring(OTHER_OPTION_PREFIX.length);
  }
  return option;
}

/**
 * Marks an option as the "other" option by adding the special prefix
 */
export function markAsOtherOption(label: string): string {
  if (isOtherOption(label)) {
    return label; // Already marked
  }
  return `${OTHER_OPTION_PREFIX}${label}`;
}

/**
 * Finds the "other" option in an array of options
 */
export function findOtherOption(options: string[]): string | null {
  return options.find(opt => isOtherOption(opt)) || null;
}

/**
 * Gets the index of the "other" option in an array
 */
export function getOtherOptionIndex(options: string[]): number {
  return options.findIndex(opt => isOtherOption(opt));
}

/**
 * Checks if a given option value is the "other" option
 */
export function isOtherOptionValue(value: string, options: string[]): boolean {
  const otherOption = findOtherOption(options);
  return otherOption !== null && value === otherOption;
}
