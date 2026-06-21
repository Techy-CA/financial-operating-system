/**
 * validators.js
 * All input validation. Returns { valid: bool, message: string }
 */

export function validateGSTIN(gstin) {
  if (!gstin) return { valid: false, message: 'GSTIN is required' };
  const clean = gstin.trim().toUpperCase();
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!regex.test(clean)) return { valid: false, message: 'Invalid GSTIN format (e.g. 22AAAAA0000A1Z5)' };
  return { valid: true, message: '' };
}

export function validatePAN(pan) {
  if (!pan) return { valid: false, message: 'PAN is required' };
  const clean = pan.trim().toUpperCase();
  const regex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!regex.test(clean)) return { valid: false, message: 'Invalid PAN format (e.g. ABCDE1234F)' };
  return { valid: true, message: '' };
}

export function validateIFSC(ifsc) {
  if (!ifsc) return { valid: false, message: 'IFSC code is required' };
  const clean = ifsc.trim().toUpperCase();
  const regex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  if (!regex.test(clean)) return { valid: false, message: 'Invalid IFSC code (e.g. SBIN0001234)' };
  return { valid: true, message: '' };
}

export function validateEmail(email) {
  if (!email) return { valid: false, message: 'Email is required' };
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email.trim())) return { valid: false, message: 'Enter a valid email address' };
  return { valid: true, message: '' };
}

export function validatePhone(phone) {
  if (!phone) return { valid: false, message: 'Phone number is required' };
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return { valid: false, message: 'Enter a valid 10-digit phone number' };
  return { valid: true, message: '' };
}

export function validateRequired(value, fieldName = 'This field') {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return { valid: false, message: `${fieldName} is required` };
  }
  return { valid: true, message: '' };
}

export function validateAmount(value, fieldName = 'Amount') {
  if (value === null || value === undefined || value === '') {
    return { valid: false, message: `${fieldName} is required` };
  }
  const num = Number(value);
  if (isNaN(num)) return { valid: false, message: `${fieldName} must be a number` };
  if (num < 0)    return { valid: false, message: `${fieldName} cannot be negative` };
  return { valid: true, message: '' };
}

export function validateUPI(upi) {
  if (!upi) return { valid: true, message: '' }; // optional
  const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
  if (!regex.test(upi.trim())) return { valid: false, message: 'Invalid UPI ID (e.g. name@upi)' };
  return { valid: true, message: '' };
}

export function validatePassword(password) {
  if (!password) return { valid: false, message: 'Password is required' };
  if (password.length < 8) return { valid: false, message: 'Password must be at least 8 characters' };
  return { valid: true, message: '' };
}

/**
 * Validate a whole form object
 * @param {object} data - field values
 * @param {object} rules - { fieldName: [validator fns] }
 * @returns {{ valid: boolean, errors: { fieldName: string } }}
 */
export function validateForm(data, rules) {
  const errors = {};
  let valid = true;

  Object.entries(rules).forEach(([field, validators]) => {
    for (const validator of validators) {
      const result = validator(data[field], field);
      if (!result.valid) {
        errors[field] = result.message;
        valid = false;
        break;
      }
    }
  });

  return { valid, errors };
}

/**
 * Show validation errors in form fields
 */
export function showFormErrors(errors) {
  // Clear existing
  document.querySelectorAll('.input.error, .select.error').forEach(el => {
    el.classList.remove('error');
  });
  document.querySelectorAll('.form-error').forEach(el => el.remove());

  Object.entries(errors).forEach(([field, message]) => {
    const input = document.querySelector(`[name="${field}"], #${field}`);
    if (!input) return;
    input.classList.add('error');

    const errEl = document.createElement('div');
    errEl.className = 'form-error';
    errEl.innerHTML = `<i class="ti ti-alert-circle" aria-hidden="true"></i> ${message}`;
    input.closest('.form-group')?.appendChild(errEl);
  });

  // Focus first error
  const firstError = document.querySelector('.input.error, .select.error');
  firstError?.focus();
}

/**
 * Clear all form errors
 */
export function clearFormErrors() {
  document.querySelectorAll('.input.error, .select.error').forEach(el => el.classList.remove('error'));
  document.querySelectorAll('.form-error').forEach(el => el.remove());
}
