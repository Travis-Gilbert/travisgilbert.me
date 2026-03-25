import 'next-auth';

declare module 'next-auth' {
  interface User {
    isOwner?: boolean;
  }
  interface Session {
    user: User & {
      isOwner?: boolean;
    };
  }
}
