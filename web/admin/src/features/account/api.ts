import { apiPost } from '../../app/api-client';
import { useAdminMutation } from '../../app/mutations';

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export function useChangePassword() {
  return useAdminMutation<{ success: true }, ChangePasswordInput>({
    mutationFn: (input) =>
      apiPost<{ success: true }>('/admin/api/account/change-password', input),
  });
}
