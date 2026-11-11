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
    viewReportQueue: boolean;
    viewReportDetails: boolean;
    viewReportEvidence: boolean;
    changeReportStatus: boolean;
    inviteAccounts: boolean;
    editAccounts: boolean;
    disableAccounts: boolean;
    deleteAccounts: boolean;
    applyPresets: boolean;
    assignPermissions: boolean;
  };
};
