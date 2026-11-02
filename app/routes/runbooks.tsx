import { Outlet } from "react-router";

export function meta() {
  return [{ title: "Runbooks · Understudy" }];
}

export default function RunbooksLayout() {
  return <Outlet />;
}
