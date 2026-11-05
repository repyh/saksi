export type DashboardAccount = {
  name: string;
  email: string;
  createdAtLabel: string;
  accessBundles: Array<{
    code: string;
    name: string;
    description: string;
    expiresAtLabel: string | null;
  }>;
  dashboardPermissions: {
    manageAccounts: boolean;
    moderateReports: boolean;
    inviteAccounts: boolean;
    editAccounts: boolean;
  };
};
