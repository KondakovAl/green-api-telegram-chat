import * as yup from 'yup';

const usernamePattern = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;
const phonePattern = /^\+?[\d\s().-]+$/;

export const newChatSchema = yup.object({
  identifier: yup
    .string()
    .trim()
    .required('Введите номер телефона или Telegram username')
    .test(
      'telegram-identifier',
      'Введите номер в международном формате или публичный @username',
      (value) => {
        if (!value) return true;

        const username = value.startsWith('@') ? value.slice(1) : value;
        if (usernamePattern.test(username)) return true;

        if (phonePattern.test(value)) {
          const digits = value.replace(/\D/g, '');
          return digits.length >= 7 && digits.length <= 15;
        }

        return false;
      },
    ),
});
