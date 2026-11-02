// Password rule for local accounts, shared by the user admin pages and the change-password page.
export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
export const PASSWORD_RULE_MESSAGE = 'The password must be at least 8 characters and include uppercase, lowercase, and a number.';
export const isStrongPassword = (value) => PASSWORD_RULE.test(String(value || ''));
