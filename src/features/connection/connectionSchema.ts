import * as yup from 'yup';

export const connectionSchema = yup.object({
  apiUrl: yup
    .string()
    .trim()
    .required('Укажите адрес API из личного кабинета GREEN-API')
    .test('https-url', 'Укажите корректный HTTPS-адрес API', (value) => {
      if (!value) return true;

      try {
        return new URL(value).protocol === 'https:';
      } catch {
        return false;
      }
    }),
  idInstance: yup
    .string()
    .trim()
    .required('Введите ID инстанса')
    .matches(/^\d+$/, {
      message: 'ID инстанса должен содержать только цифры',
      excludeEmptyString: true,
    }),
  apiTokenInstance: yup.string().trim().required('Введите токен инстанса'),
});
