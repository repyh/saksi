export type SignUpContract = {
  name: string;
  email: string;
  password: string;
};

export type SignInContract = {
  email: string;
  password: string;
  rememberMe?: boolean;
};
