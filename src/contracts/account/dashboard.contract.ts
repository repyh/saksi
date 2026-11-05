export type DashboardAccount = {
  name: string;
  email: string;
  createdAtLabel: string;
  permissions: Array<{
    code: string;
    description: string;
  }> | null;
  dashboardPermissions: {
    viewOwnPermissions: boolean;
    manageAccounts: boolean;
    moderateReports: boolean;
    inviteAccounts: boolean;
    editAccounts: boolean;
    applyPresets: boolean;
    assignPermissions: boolean;
  };
};
