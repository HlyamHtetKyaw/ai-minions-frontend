/**
 * After the server commits points (generation, translate, export, …), dispatch this so
 * {@link AuthSessionProvider} can refetch `/me` and the header balance updates without a full reload.
 */
export const USER_CREDIT_BALANCE_REFRESH_EVENT = 'aiminions-user-credit-balance-refresh';

export function notifyUserCreditBalanceRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(USER_CREDIT_BALANCE_REFRESH_EVENT));
}
