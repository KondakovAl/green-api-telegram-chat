import type { FormErrors } from '@mantine/form';
import { yupResolver } from 'mantine-form-yup-resolver';
import type { ObjectSchema } from 'yup';

export function yupFormResolver<Values extends object>(schema: ObjectSchema<Values>) {
  const resolve = yupResolver(schema as ObjectSchema<any>);
  return (values: Values): FormErrors => resolve(values as Record<string, unknown>);
}
