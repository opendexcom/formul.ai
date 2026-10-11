import React from 'react';
import {
  getPasswordStrength,
  getPasswordRuleChecks,
  PASSWORD_REQUIREMENTS_MESSAGE,
  type PasswordStrength as StrengthLabel,
} from '../../utils/passwordValidation';
import { Check, X } from 'lucide-react';

interface PasswordStrengthIndicatorProps {
  password: string;
  showRuleChecks?: boolean;
  showHelperText?: boolean;
}

const strengthStyles: Record<StrengthLabel, { label: string; barClass: string; textClass: string }> = {
  weak: { label: 'Weak', barClass: 'bg-red-500', textClass: 'text-red-600' },
  fair: { label: 'Fair', barClass: 'bg-amber-500', textClass: 'text-amber-600' },
  strong: { label: 'Strong', barClass: 'bg-green-500', textClass: 'text-green-600' },
};

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  showRuleChecks = true,
  showHelperText = true,
}) => {
  const strength = getPasswordStrength(password);
  const rules = getPasswordRuleChecks(password);
  const filledBars = strength === 'weak' ? 1 : strength === 'fair' ? 2 : 3;
  const style = strengthStyles[strength];

  return (
    <div className="mt-2 space-y-2">
      {showHelperText && (
        <p className="text-xs text-gray-500">{PASSWORD_REQUIREMENTS_MESSAGE}</p>
      )}
      {password.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-0.5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= filledBars ? style.barClass : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <span className={`text-xs font-medium ${style.textClass}`}>{style.label}</span>
        </div>
      )}
      {showRuleChecks && password.length > 0 && (
        <ul className="text-xs text-gray-600 space-y-1">
          {rules.map((r) => (
            <li key={r.label} className="flex items-center gap-2">
              {r.met ? (
                <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
              ) : (
                <X className="w-3.5 h-3.5 text-gray-300 shrink-0" />
              )}
              <span className={r.met ? 'text-gray-700' : 'text-gray-500'}>{r.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PasswordStrengthIndicator;
